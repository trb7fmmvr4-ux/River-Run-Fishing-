import Phaser from 'phaser';
import { CAMERA, DEPTH, ECONOMY, INPUT, PLAYER, SCENE_KEYS, TEXTURE_KEYS } from '../config/GameConfig';
import { getZoneDefinition, STARTING_ZONE_ID, canonicalZoneId } from '../data/ZoneData';
import { Player } from '../entities/Player';
import { ArtRegistry } from '../utils/AssetRegistry';
import { InputManager } from '../systems/InputManager';
import { FishingSystem, FishingEvents } from '../systems/FishingSystem';
import { Inventory } from '../systems/Inventory';
import { Cooler } from '../systems/Cooler';
import { GoldWallet } from '../systems/GoldWallet';
import { Shop } from '../systems/Shop';
import { FishingHUD } from '../ui/FishingHUD';
import { EquipmentManager } from '../systems/tools/EquipmentManager';
import { HeldEquipmentVisual } from '../entities/HeldEquipmentVisual';
import { FishingRodTool } from '../systems/tools/FishingRodTool';
import { MenuButtons } from '../ui/MenuButtons';
import { Zone } from '../world/Zone';
import { SaveSystem } from '../systems/SaveSystem';
import { Journal, JournalEvents } from '../systems/Journal';
import { StoryProgress, StoryFlags } from '../systems/StoryProgress';
import { Progression, ProgressionEvents } from '../systems/Progression';
import { QuestSystem, QuestEvents } from '../systems/QuestSystem';
import { Environment, EnvironmentEvents, timeOfDayLabel, weatherLabel } from '../systems/Environment';
import { BaitSystem, BaitEvents } from '../systems/BaitSystem';
import { getBait } from '../data/BaitData';
import { PlaceholderSound } from '../utils/PlaceholderSound';
import { spawnParticleBurst } from '../utils/ParticleBurst';
import { Health } from '../systems/Health';
import { CombatSystem, CombatEvents } from '../systems/CombatSystem';
import { IntroSequence, IntroEvents } from './controllers/IntroSequence';
import { createBusSubscription } from '../utils/EventBus';
import { HUDScene, type HUDSceneData } from './HUDScene';
import { UIPanelController } from './controllers/UIPanelController';
import { JourneyDirector } from './controllers/JourneyDirector';
import { ZoneDebugOverlay } from '../debug/ZoneDebugOverlay';

/**
 * The playable scene: a data-driven Zone (ground, water with collision,
 * fishing areas), the player, camera, input, the fishing loop, and the
 * economy (Inventory/Cooler/Gold/Shop) wired together.
 *
 * The world is built from a ZoneDefinition via the Zone class. Swapping to
 * a different zone is a one-line change of the starting-zone id.
 */
export class MainScene extends Phaser.Scene {
  private player!: Player;
  private inputManager!: InputManager;
  private zone!: Zone;
  private currentZoneId: string = STARTING_ZONE_ID;
  private fishingSystem!: FishingSystem;
  private fishingHUD!: FishingHUD;
  private inventory!: Inventory;
  private cooler!: Cooler;
  private goldWallet!: GoldWallet;
  private shop!: Shop;
  private equipment!: EquipmentManager;
  private heldVisual!: HeldEquipmentVisual;
  private hud!: HUDScene;
  /** True while the pause menu is open — gates gameplay updates (movement, fishing, combat) without using Phaser's own scene.pause(), so this scene's own update loop (and the overlay it drives) keeps running. */
  private isPaused = false;
  private panels!: UIPanelController;
  private journey!: JourneyDirector;
  private menuButtons?: MenuButtons;
  private journal!: Journal;
  private story!: StoryProgress;
  private progression!: Progression;
  private quests!: QuestSystem;
  private environment!: Environment;
  private bait!: BaitSystem;
  private uiSound!: PlaceholderSound;
  private lastBumpAt = 0;
  private playerHealth!: Health;
  private combat!: CombatSystem;
  private intro?: IntroSequence;
  private zoneDebug!: ZoneDebugOverlay;
  private readonly bus = createBusSubscription();
  private pendingLoadSlot: number | null = null;
  private boundSaveSlot: number | null = null;

  constructor() {
    super(SCENE_KEYS.MAIN);
  }

  /**
   * Receives optional routing data from the Main Menu:
   *   { loadSlot }  → restore that save after systems are built
   *   { newGame }   → start fresh (no save applied)
   *   {}            → Play: fresh session, not bound to a slot until saved
   * Additive only; absence of data preserves the original fresh-start path.
   */
  public init(data?: { loadSlot?: number; newGame?: boolean }): void {
    this.pendingLoadSlot = typeof data?.loadSlot === 'number' ? data.loadSlot : null;
    this.boundSaveSlot = this.pendingLoadSlot; // saving "Continue"s back to the loaded slot by default
  }

  public create(): void {
    this.zone = new Zone(getZoneDefinition(STARTING_ZONE_ID));
    const { widthPx, heightPx } = this.zone.build(this);
    this.zoneDebug = new ZoneDebugOverlay(this);
    this.zoneDebug.refresh(this, this.zone);

    this.physics.world.setBounds(0, 0, widthPx, heightPx);

    // Spawn on dry land, not the (now solid) water. The beach water is on
    // the east edge, so the centre-west is safe; nudge out of water just
    // in case a future starting zone overlaps the spawn.
    const spawn = this.findDrySpawn(widthPx / 2, heightPx / 2);
    const realPlayerKey = ArtRegistry.player('idle', 'down');
    const initialTexture = this.textures.exists(realPlayerKey) ? realPlayerKey : TEXTURE_KEYS.PLAYER;
    this.player = new Player(this, spawn.x, spawn.y, initialTexture);
    this.player.setDepth(DEPTH.PLAYER);

    // Water becomes blocked terrain: static bodies the player collides
    // with. Owned entirely by the Zone.
    this.zone.enableWaterCollision(this, this.player, () => this.onSolidBump());

    // Camera must be fully configured (zoom especially) before any
    // screen-anchored UI below is constructed — those classes compute
    // their on-screen position from the camera's current zoom/scroll the
    // moment they're created, so doing this any later would make their
    // very first frame use the wrong zoom (1, not 2).
    this.cameras.main.setBounds(0, 0, widthPx, heightPx);
    this.cameras.main.setZoom(CAMERA.ZOOM);
    this.cameras.main.startFollow(this.player, true, CAMERA.LERP, CAMERA.LERP);

    // The menu fades its camera to black before starting this scene. A fresh
    // scene gets a fresh (un-faded) camera, but we fade in explicitly here so
    // entry is always a clean reveal and the camera can never be left dark —
    // matching what every other scene's create() does.
    this.cameras.main.fadeIn(250, 11, 15, 20);

    this.inputManager = new InputManager(this);
    this.fishingSystem = new FishingSystem(this);
    this.fishingHUD = new FishingHUD(this, this.player);

    this.inventory = new Inventory(null);
    this.cooler = new Cooler(ECONOMY.COOLER_STARTING_CAPACITY);
    this.goldWallet = new GoldWallet(ECONOMY.STARTING_GOLD);
    this.shop = new Shop(this.cooler, this.goldWallet);

    // Bait is created early so the inventory panel can host its selector.
    this.bait = new BaitSystem();
    // Story is created early so the gold HUD can show the current rod tier.
    this.story = new StoryProgress();
    // Progression is created early so the inventory panel can show skill levels.
    this.progression = new Progression();

    // --- New first-playable systems (all additive) ---
    this.journal = new Journal();
    this.playerHealth = new Health(3, { invulnMs: 700, channel: 'player' });
    this.combat = new CombatSystem(this, this.player, this.playerHealth);

    // --- Loop-content systems (Phases 3/7/8) ---
    this.quests = new QuestSystem(this.goldWallet, this.story, this.inventory);
    this.uiSound = new PlaceholderSound();

    // --- Environment (day cycle + weather) ---
    this.environment = new Environment();

    // All pure-UI is owned by HUDScene, running alongside this scene with
    // its own, never-zoomed, never-scrolled camera — see HUDScene's doc
    // comment for why. Launched after MainScene, so it renders on top.
    this.scene.launch(SCENE_KEYS.HUD, {
      goldWallet: this.goldWallet,
      story: this.story,
      bait: this.bait,
      inventory: this.inventory,
      cooler: this.cooler,
      shop: this.shop,
      progression: this.progression,
      playerHealth: this.playerHealth,
      quests: this.quests,
      journal: this.journal,
      environment: this.environment,
      onResume: () => this.resumeFromPause(),
      onQuitToMenu: () => this.quitToMenu()
    } as HUDSceneData);
    this.hud = this.scene.get(SCENE_KEYS.HUD) as HUDScene;

    // --- Equipment architecture: the hotbar's selected slot decides which
    // Tool "use" (Left Mouse) delegates to. Only slot 0 has a tool right
    // now (the rod); slot 1 (bait) is a passive equip, not a left-click
    // tool, so it's intentionally left unregistered here.
    //
    // The hotbar getter below is lazy on purpose: `scene.launch()` queues
    // HUDScene's own create() for the next update tick rather than running
    // it synchronously, so `this.hud.hotbar` does not exist yet at this
    // exact point — only resolving it later, at actual tool-use time (well
    // after HUDScene has finished), is safe. (A previous version of this
    // comment claimed the launch was synchronous; it isn't — see the
    // 'hud-create-complete' listener below, added after that assumption
    // caused a real crash.)
    this.equipment = new EquipmentManager(() => this.hud.hotbar);
    this.equipment.equip(
      0,
      new FishingRodTool(this.fishingSystem, this.combat, () => this.zone.canFishFrom(this.player.x, this.player.y))
    );
    this.heldVisual = new HeldEquipmentVisual(this);

    // Rod progression → fishing: the rod tier the story tracks now widens
    // the bite reaction window. Additive hook; fishing is otherwise unchanged.
    this.fishingSystem.setRodTierProvider(() => this.story.rod);

    // Fishing now draws from the current zone/time, biased by weather/bait —
    // so where, when, and how you fish all influence the catch. Additive hook.
    this.fishingSystem.setFishContextProvider(() => ({
      zoneId: canonicalZoneId(this.currentZoneId),
      time: this.environment.dayNight,
      weather: this.environment.currentWeather,
      bait: this.bait.equippedId
    }));

    // Journal records the conditions a species was first discovered under.
    this.journal.setContextProvider(() => ({
      zoneId: canonicalZoneId(this.currentZoneId),
      time: timeOfDayLabel(this.environment.time),
      weather: weatherLabel(this.environment.currentWeather)
    }));

    this.wireFirstPlayable();
    this.wireLoopContent();

    // Panel controller: enforces single-panel-at-a-time and mid-cast gating.
    this.panels = new UIPanelController(
      {
        inventoryPanel: this.hud.inventoryPanel,
        shopPanel:      this.hud.shopPanel,
        journalPanel:   this.hud.journalPanel
      },
      this.fishingSystem,
      this.uiSound
    );

    // Journey director: owns spatial story triggers, village lifecycle,
    // zone-edge transitions, and player death/respawn.
    this.journey = new JourneyDirector({
      scene:              this,
      player:             this.player,
      getZone:            () => this.zone,
      getCurrentZoneId:   () => this.currentZoneId,
      story:              this.story,
      combat:             this.combat,
      fishing:            this.fishingSystem,
      fishingHUD:         this.fishingHUD,
      notifications:      { push: (t, v) => this.hud.notifications.push(t, v) },
      playerHealthHUD:    { show: () => this.hud.playerHealthHUD.show() },
      playerHealth:       this.playerHealth,
      getIntro:           () => this.intro,
      getSaveableSystems: () => this.saveableSystems(),
      getBoundSaveSlot:   () => this.boundSaveSlot,
      setBoundSaveSlot:   (s) => { this.boundSaveSlot = s; },
      transitionToZone:   (id, opts) => this.transitionToZone(id, opts),
      openShop:           () => this.panels.toggleShop(),
      startNpcDialogue:   (name, lines) => this.hud.npcDialogue?.start(lines.map((text) => ({ speaker: name, text }))),
      findDrySpawn:       (x, y) => this.findDrySpawn(x, y)
    });

    // On-screen menu toggles (kept for touch / as click fallback). Gated
    // by config so the desktop layout can hide them; keyboard I/B always
    // work regardless. The class stays intact for mobile reactivation.
    if (INPUT.ENABLE_ONSCREEN_MENU_BUTTONS) {
      this.menuButtons = new MenuButtons(this, {
        onToggleInventory: () => this.panels.toggleInventory(),
        onToggleShop:      () => this.panels.toggleShop()
      });
    }

    // Restore a save if the menu requested one. Uses only the economy
    // systems' public APIs / events (see SaveSystem) — no gameplay logic
    // is touched here; this just replays state into freshly-built systems.
    let savedZoneId: string | null = null;
    if (this.pendingLoadSlot !== null) {
      const data = SaveSystem.read(this.pendingLoadSlot);
      if (data) {
        SaveSystem.apply(data, this.saveableSystems());
        savedZoneId = data.player?.zoneId ?? null;
      }
    }

    // Start the scripted beach intro only for a genuinely new game (no save
    // loaded and the tutorial flag isn't set). Loaded games skip straight
    // to free play.
    //
    // This whole block is deferred to HUDScene's explicit readiness signal
    // rather than running inline here: `scene.launch()` (above) queues
    // HUDScene's own create() for the NEXT update tick rather than running
    // it synchronously, so `this.hud.hotbar`, `this.hud.notifications`, and
    // `this.hud.playerHealthHUD` do not exist yet at this exact point in
    // MainScene's own create() — dereferencing any of them here threw
    // "undefined is not an object" the moment this code ran. Waiting for
    // the real signal that HUDScene's fields exist is the fix; nothing
    // else in this method depends on `this.intro` being assigned yet, so
    // deferring only this block is safe.
    this.hud.events.once('hud-create-complete', () => {
      if (!this.story.has(StoryFlags.TUTORIAL_DONE)) {
        this.intro = new IntroSequence(
          this,
          this.story,
          this.player,
          this.hud,
          this.hud.hotbar,
          this.hud.notifications,
          this.quests
        );
        this.intro.begin();
      } else {
        this.hud.playerHealthHUD.show();
      }
    });

    // Reflect saved progression flags before the first frame so the journey
    // director doesn't re-trigger already-cleared story beats on load.
    this.journey.restoreFromSave();

    // If the save was in a different (unlocked) zone, build that zone now
    // instead of the beach. Done instantly (no fade) since this is the
    // initial load. Player x/y were already restored by SaveSystem; we
    // only swap the world around them. Falls back to beach for absent or
    // locked zone ids, preserving backward compatibility with old saves.
    if (savedZoneId) {
      const target = canonicalZoneId(savedZoneId);
      if (target !== 'beach' && this.story.isZoneUnlocked(target)) {
        this.enterZoneImmediate(target);
      }
    }

    // Re-populate the beach village if the save had already reached it.
    this.journey.restoreVillageIfNeeded();

    this.registerSystemKeys();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  /** Bundles every system the SaveSystem reads/writes, incl. the new ones. */
  private saveableSystems() {
    return {
      gold: this.goldWallet,
      cooler: this.cooler,
      inventory: this.inventory,
      journal: this.journal,
      story: this.story,
      progression: this.progression,
      quests: this.quests,
      environment: this.environment,
      bait: this.bait,
      getPlayerState: () => ({ x: this.player.x, y: this.player.y, zoneId: this.currentZoneId }),
      setPlayerPosition: (x: number, y: number) => this.player.setPosition(x, y)
    };
  }

  /**
   * Wires the new first-playable beats together via events — none of this
   * touches fishing/movement/economy logic; it only listens and reacts.
   */
  private wireFirstPlayable(): void {
    // Tutorial hints surface through the existing HUD message banner.
    this.bus.on(IntroEvents.HINT, (text: string) => this.fishingHUD.flashSystemMessage(text), this);

    // When the intro completes, reveal health and arm the slime encounter.
    this.bus.on(IntroEvents.COMPLETE, () => this.hud.playerHealthHUD.show(), this);

    // Combat outcomes.
    this.bus.on(CombatEvents.ENCOUNTER_CLEARED, () => this.journey.onEncounterCleared(), this);
    this.bus.on(
      CombatEvents.PLAYER_ATTACK,
      () => {
        this.journey.markSwingAttempted();
        this.player.animator.playAttack();
      },
      this
    );
    this.bus.on(
      CombatEvents.PLAYER_HURT,
      () => {
        this.cameras.main.flash(120, 120, 20, 20);
        if (!this.playerHealth.isDead) this.player.animator.playHurt();
        // Reinforce the "how to fight" hint if the player is taking hits
        // without having tried swinging yet — they likely missed or
        // dismissed the original hint. Only during the first encounter.
        if (this.combat.isActive && !this.journey.hasAttemptedSwing) {
          this.fishingHUD.flashSystemMessage('Click to swing your rod!', 2500);
        }
        if (this.playerHealth.isDead) this.journey.onPlayerDefeated();
      },
      this
    );

    // Fishing motion — cast on actually casting, reel on either outcome
    // (a brief reel-in plays whether the fish got away or not).
    // Cast holds the rod-out pose until the line comes back in (whatever
    // the reason — catch, miss, or walking away), matching the "keep the
    // rod visible while a line is out" requirement with the art that
    // actually exists (no dedicated fishing-idle pose, so holding cast's
    // last frame is the closest approximation).
    this.bus.on(FishingEvents.CAST, () => this.player.animator.playAndHold('cast'), this);
    this.bus.on(FishingEvents.CATCH_SUCCESS, () => this.player.animator.playReel(), this);
    this.bus.on(FishingEvents.CATCH_FAILURE, () => this.player.animator.playReel(), this);
    this.bus.on(FishingEvents.CANCELLED, () => this.player.animator.release(), this);
  }

  /**
   * Surfaces loop-content feedback (quests, levels, record catches) through
   * the existing HUD message banner. All read-only listeners — the systems
   * themselves own the logic; this only narrates it to the player.
   */
  private wireLoopContent(): void {
    this.bus.on(
      ProgressionEvents.LEVEL_UP,
      (p: { skill: string; level: number }) => {
        const skill = p.skill.charAt(0).toUpperCase() + p.skill.slice(1);
        this.hud.notifications.push(`${skill} Level ${p.level}!`, 'success');
      },
      this
    );
    this.bus.on(
      QuestEvents.COMPLETED,
      (q: { name: string; reward: { gold?: number } }) => {
        const goldPart = q.reward.gold ? ` (+${q.reward.gold}g)` : '';
        this.hud.notifications.push(`Quest complete: ${q.name}${goldPart}`, 'success');
        this.uiSound.playQuestComplete();
        spawnParticleBurst(this, this.player.x, this.player.y - 18);
      },
      this
    );
    this.bus.on(
      QuestEvents.STARTED,
      (q: { name: string; summary: string }) => this.hud.notifications.push(`Quest Accepted: ${q.name} — ${q.summary}`, 'info'),
      this
    );
    this.bus.on(
      JournalEvents.RECORDED,
      (r: { fish: { name: string }; isRecord: boolean; weightKg: number }) => {
        if (r.isRecord) {
          this.hud.notifications.push(`New record! ${r.fish.name} ${r.weightKg}kg`, 'info');
        }
      },
      this
    );
    this.bus.on(
      JournalEvents.DISCOVERED,
      (fish: { name: string }) => {
        const s = this.journal.stats();
        this.hud.notifications.push(`New fish: ${fish.name}!  (${s.discovered}/${s.totalSpecies})`, 'success');
      },
      this
    );
    this.bus.on(
      EnvironmentEvents.TIME_CHANGED,
      (t: import('../systems/Environment').TimeOfDay) =>
        this.hud.notifications.push(`${timeOfDayLabel(t)} settles over the water`, 'info'),
      this
    );
    this.bus.on(
      EnvironmentEvents.WEATHER_CHANGED,
      (w: import('../systems/Environment').Weather) =>
        this.hud.notifications.push(`Weather: ${weatherLabel(w)}`, 'info'),
      this
    );
    this.bus.on(
      BaitEvents.CHANGED,
      (id: string) => {
        const name = getBait(id)?.name ?? 'No Bait';
        this.hud.notifications.push(`Bait equipped: ${name}`, 'info');
      },
      this
    );
  }

  /**
   * Quicksave (F5) and return-to-menu (Esc) keys. Saving writes to the
   * bound slot (the one a Continue/Load came from), or slot 0 for a fresh
   * Play session. Purely presentational glue around the SaveSystem; adds
   * no gameplay rules.
   */
  private registerSystemKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    // Hotbar slot selection — 1/2 select directly, mouse wheel cycles.
    // Selection only changes which slot is highlighted (see HotbarHUD's
    // doc comment); it does not redirect what Space does. Gated behind
    // the same "anything is open" check the action key uses, so an
    // unrelated scroll (or one intended for a future scrollable panel)
    // can never silently change hotbar selection underneath it.
    const hotbarInputBlocked = (): boolean =>
      this.hud.inventoryPanel.isOpen ||
      this.hud.shopPanel.isOpen ||
      this.hud.journalPanel.isOpen ||
      (this.intro?.isDialogueOpen ?? false) ||
      (this.hud.npcDialogue?.isActive ?? false);

    const NUMBER_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    NUMBER_KEYS.forEach((keyName, index) => {
      keyboard.on(`keydown-${keyName}`, () => {
        if (hotbarInputBlocked()) return;
        // "If slot empty, nothing happens" — slotExists is a hard check,
        // not just a highlight change, so pressing 3-9 today (only 2
        // slots are populated) is correctly a no-op rather than wrapping
        // around to an existing slot.
        if (this.hud.hotbar.slotExists(index)) this.hud.hotbar.setSelected(index);
      });
    });
    this.input.on('wheel', (_pointer: unknown, _go: unknown, _dx: number, dy: number) => {
      if (hotbarInputBlocked()) return;
      this.hud.hotbar.cycleSelected(dy > 0 ? 1 : -1);
    });

    keyboard.on('keydown-F5', () => {
      const slot = this.boundSaveSlot ?? 0;
      const ok = SaveSystem.save(slot, this.saveableSystems());
      this.boundSaveSlot = slot;
      if (ok) {
        this.fishingHUD.flashSystemMessage?.('Game saved');
      } else {
        this.hud.notifications.push('Save failed — check storage.', 'warning');
      }
    });

    keyboard.on('keydown-ESC', () => {
      if (this.hud.pauseOverlay.isOpen) {
        this.resumeFromPause();
      } else {
        this.isPaused = true;
        this.hud.pauseOverlay.show();
      }
    });

    // J toggles the Fish Journal.
    keyboard.on('keydown-J', () => this.panels.toggleJournal());
  }

  /**
   * Feedback for bumping a solid object (tree/rock) — previously silent.
   * Rate-limited so repeatedly pressing into the same obstacle doesn't
   * spam the sound on every physics step.
   */
  /** Show a one-time contextual tutorial hint (3s hold, via the existing fishingHUD message system) — never fires again once shown, tracked via a StoryFlag so it survives save/reload. */
  private showHintOnce(flag: string, text: string): void {
    if (this.story.has(flag)) return;
    this.story.setFlag(flag);
    this.fishingHUD.flashSystemMessage(text, 3000);
  }

  private onSolidBump(): void {
    const now = this.time.now;
    if (now - this.lastBumpAt < 250) return;
    this.lastBumpAt = now;
    this.uiSound.playBump();
  }

  /** Walk outward from a desired spawn until a non-water tile is found. */
  private findDrySpawn(preferredX: number, preferredY: number): { x: number; y: number } {
    if (!this.zone.isWater(preferredX, preferredY)) {
      return { x: preferredX, y: preferredY };
    }
    for (let step = 16; step < this.zone.widthPx; step += 16) {
      const candidateX = preferredX - step;
      if (candidateX > 0 && !this.zone.isWater(candidateX, preferredY)) {
        return { x: candidateX, y: preferredY };
      }
    }
    return { x: preferredX, y: preferredY };
  }

  /**
   * Swap the active zone in place (no scene restart). Tears down the current
   * zone's world (Zone.destroy), builds the requested one, resets physics
   * and camera bounds, and repositions the player onto dry land. All the
   * persistent systems (economy, quests, journal, progression, HUDs) stay
   * alive — only the world changes — so this is additive and changes no
   * gameplay logic. Gated on the zone being unlocked.
   *
   * Returns true if the transition happened.
   */
  private transitionToZone(zoneId: string, options: { spawnX?: number; spawnY?: number } = {}): boolean {
    const targetId = canonicalZoneId(zoneId);
    if (targetId === canonicalZoneId(this.currentZoneId)) return false;
    if (!this.story.isZoneUnlocked(targetId)) {
      this.fishingHUD.flashSystemMessage('That way is not open yet.');
      return false;
    }
    // Don't transition mid-cast; let the fishing action resolve first.
    if (this.fishingSystem.isActive) return false;

    const camera = this.cameras.main;
    camera.fadeOut(220, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // 1) Tear down the old world. Village NPCs are owned by JourneyDirector;
      // destroy through it so its state stays consistent.
      this.zone.destroy(this);
      this.journey.destroyVillageNPCs();

      // 2) Build the new one (mirrors the create() world-build sequence).
      this.zone = new Zone(getZoneDefinition(targetId));
      const { widthPx, heightPx } = this.zone.build(this);
      this.physics.world.setBounds(0, 0, widthPx, heightPx);

      // 3) Reposition the player onto dry land in the new zone.
      const sx = options.spawnX ?? widthPx * 0.1;
      const sy = options.spawnY ?? heightPx / 2;
      const spawn = this.findDrySpawn(sx, sy);
      this.player.setPosition(spawn.x, spawn.y);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);

      // 4) Re-enable water collision + camera bounds for the new world.
      this.zone.enableWaterCollision(this, this.player, () => this.onSolidBump());
      camera.setBounds(0, 0, widthPx, heightPx);

      this.currentZoneId = targetId;

      // 5) Re-populate the beach village if returning to it (beach-zone fixture).
      this.journey.restoreVillageAfterTransition(targetId);

      this.zoneDebug.refresh(this, this.zone);
      camera.fadeIn(220, 0, 0, 0);
      this.hud.notifications.push(`Entering ${this.zone.name}`, 'info');

      // Autosave arrival in the new zone so re-loading resumes here.
      const slot = this.boundSaveSlot ?? 0;
      SaveSystem.save(slot, this.saveableSystems());
      this.boundSaveSlot = slot;
    });
    return true;
  }

  /**
   * Build a zone immediately (no fade), keeping the player's current
   * position. Used only on initial load to resume in the saved zone — the
   * player's x/y was already restored by SaveSystem, so we just swap the
   * world and bounds around them (nudging out of water if needed).
   */
  private enterZoneImmediate(zoneId: string): void {
    const targetId = canonicalZoneId(zoneId);
    this.zone.destroy(this);
    this.zone = new Zone(getZoneDefinition(targetId));
    const { widthPx, heightPx } = this.zone.build(this);
    this.physics.world.setBounds(0, 0, widthPx, heightPx);

    // Keep the restored position, but make sure it isn't inside (now solid)
    // water or outside the new bounds.
    let px = Phaser.Math.Clamp(this.player.x, 8, widthPx - 8);
    let py = Phaser.Math.Clamp(this.player.y, 8, heightPx - 8);
    if (this.zone.isWater(px, py)) {
      const dry = this.findDrySpawn(px, py);
      px = dry.x;
      py = dry.y;
    }
    this.player.setPosition(px, py);

    this.zone.enableWaterCollision(this, this.player, () => this.onSolidBump());
    this.cameras.main.setBounds(0, 0, widthPx, heightPx);
    this.currentZoneId = targetId;
    this.zoneDebug.refresh(this, this.zone);
  }

  public update(_time: number, delta: number): void {
    if (this.isPaused) return;

    this.panels.handleToggles(this.inputManager);
    this.environment.update(delta);
    this.combat.update();
    this.journey.update();

    const anyPanelOpen   = this.panels.anyOpen;
    const dialogueOpen    = this.intro?.isDialogueOpen ?? false;
    const npcDialogueOpen = this.hud.npcDialogue?.isActive ?? false;
    const anyDialogueOpen = dialogueOpen || npcDialogueOpen;

    // Always consumed every frame regardless of gating below so a press
    // that lands while a panel/dialogue is open is drained here and can
    // never leak into a later frame as a stale tool-use.
    const useToolPressed  = this.inputManager.isUseToolJustPressed();
    const interactPressed = this.inputManager.isInteractJustPressed();

    // Interaction priority:
    //   1. Active UI (panels) — handled by the panels themselves.
    //   2. Dialogue — advances on its own input.
    //   3. Interactable NPC (E) — routed through JourneyDirector.
    //   4. Equipped tool (Left Mouse) — whatever the hotbar has selected.
    //   5. Passive gameplay (movement, below).
    if (!anyPanelOpen && !anyDialogueOpen) {
      if (interactPressed && this.journey.handleInteract()) {
        this.showHintOnce(StoryFlags.HINT_INTERACT_SHOWN, 'E to Interact');
      } else if (useToolPressed) {
        this.equipment.useEquipped();
      }
    }

    const shouldHoldPosition = anyPanelOpen || anyDialogueOpen;
    const movementIntent = shouldHoldPosition ? { x: 0, y: 0 } : this.inputManager.getMovementIntent();
    if (movementIntent.x !== 0 || movementIntent.y !== 0) {
      this.showHintOnce(StoryFlags.HINT_MOVE_SHOWN, 'WASD to Move');
    }

    if (this.fishingSystem.isActive && (movementIntent.x !== 0 || movementIntent.y !== 0)) {
      this.fishingSystem.cancel();
    }

    const inSoftZone = this.zone.isInSoftZone(this.player.x, this.player.y);
    const sprinting  = this.inputManager.isSprintDown();
    const speedMultiplier = (inSoftZone ? 0.55 : 1) * (sprinting ? PLAYER.SPRINT_MULTIPLIER : 1);
    this.player.applyMovement(movementIntent, delta, speedMultiplier);

    this.inputManager.update();
    this.hud.debugOverlay.setFishingState(this.fishingSystem.currentState);
    this.hud.debugOverlay.setEntityCount(this.combat.activeSlimeCount);
    this.fishingHUD.update();
    this.menuButtons?.update();

    if (this.story.has(StoryFlags.RECEIVED_ROD)) {
      this.heldVisual.setEquippedTool(this.equipment.equippedTool?.id);
      this.heldVisual.update(this.player as unknown as { x: number; y: number }, this.player.animator);
    }
  }

  /** Close the pause overlay and let gameplay updates resume. */
  private resumeFromPause(): void {
    this.isPaused = false;
    this.hud.pauseOverlay.hide();
  }

  /** The pause menu's "Quit to Menu" — autosave then fade to the main menu. */
  private quitToMenu(): void {
    if (this.boundSaveSlot !== null) {
      SaveSystem.save(this.boundSaveSlot, this.saveableSystems());
    }
    this.cameras.main.fadeOut(300, 11, 15, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }

  private handleShutdown(): void {
    this.inputManager?.destroy();
    this.fishingSystem?.destroy();
    this.fishingHUD?.destroy();
    this.cooler?.destroy();
    this.menuButtons?.destroy();
    // Tear down the active zone (sprites, water animation timers, colliders).
    this.zone?.destroy(this);
    // New first-playable systems.
    this.journal?.destroy();
    this.combat?.destroy();
    this.heldVisual?.destroy();
    this.intro?.destroy();
    this.journey?.destroy();
    // Loop-content systems.
    this.progression?.destroy();
    this.quests?.destroy();
    this.uiSound?.destroy();
    this.zoneDebug?.destroy();
    // HUDScene runs alongside this scene and is never stopped on its own
    // (zone transitions don't touch it — only this scene's own full
    // shutdown should). Stopping it here triggers HUDScene's own
    // SHUTDOWN handler, which destroys every UI element it owns.
    this.scene.stop(SCENE_KEYS.HUD);
    this.bus.dispose();
  }
}
