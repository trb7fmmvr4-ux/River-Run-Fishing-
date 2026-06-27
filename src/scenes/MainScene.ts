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
import { IntroSequence, IntroEvents } from '../systems/IntroSequence';
import { VillageNPCs } from '../world/VillageNPCs';
import { EventBus } from '../utils/EventBus';
import { HUDScene, type HUDSceneData } from './HUDScene';

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
  private villageNPCs?: VillageNPCs;
  private slimeEncounterTriggered = false;
  /** True once the player has attempted at least one swing in the first encounter. */
  private hasAttemptedFirstSwing = true;
  private villageReached = false;
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

    // On-screen menu toggles (kept for touch / as click fallback). Gated
    // by config so the desktop layout can hide them; keyboard I/B always
    // work regardless. The class stays intact for mobile reactivation.
    if (INPUT.ENABLE_ONSCREEN_MENU_BUTTONS) {
      this.menuButtons = new MenuButtons(this, {
        onToggleInventory: () => this.toggleInventoryPanel(),
        onToggleShop: () => this.toggleShopPanel()
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

    // If a loaded save had already progressed, reflect that in the live
    // scene so the player resumes where they left off.
    if (this.story.has(StoryFlags.FIRST_SLIME)) {
      this.slimeEncounterTriggered = true; // don't re-trigger a cleared fight
    }

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

    // The village lives in the beach zone, so only populate it when the
    // player is actually there (e.g. loaded onto the beach, not upriver).
    if (this.story.has(StoryFlags.REACHED_VILLAGE) && canonicalZoneId(this.currentZoneId) === 'beach') {
      this.villageReached = true;
      this.spawnVillage();
    }

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
    EventBus.on(IntroEvents.HINT, (text: string) => this.fishingHUD.flashSystemMessage(text), this);

    // When the intro completes, reveal health and arm the slime encounter.
    EventBus.on(IntroEvents.COMPLETE, () => this.hud.playerHealthHUD.show(), this);

    // Combat outcomes.
    EventBus.on(CombatEvents.ENCOUNTER_CLEARED, this.onEncounterCleared, this);
    EventBus.on(
      CombatEvents.PLAYER_ATTACK,
      () => {
        this.hasAttemptedFirstSwing = true;
        this.player.animator.playAttack();
      },
      this
    );
    EventBus.on(
      CombatEvents.PLAYER_HURT,
      () => {
        this.cameras.main.flash(120, 120, 20, 20);
        if (!this.playerHealth.isDead) this.player.animator.playHurt();
        // Reinforce the "how to fight" hint if the player is taking hits
        // without having tried swinging yet — they likely missed or
        // dismissed the original hint. Only during the first encounter;
        // never if they've already swung at least once.
        if (this.combat.isActive && !this.hasAttemptedFirstSwing) {
          this.fishingHUD.flashSystemMessage('Click to swing your rod!', 2500);
        }
        if (this.playerHealth.isDead) this.onPlayerDefeated();
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
    EventBus.on(FishingEvents.CAST, () => this.player.animator.playAndHold('cast'), this);
    EventBus.on(FishingEvents.CATCH_SUCCESS, () => this.player.animator.playReel(), this);
    EventBus.on(FishingEvents.CATCH_FAILURE, () => this.player.animator.playReel(), this);
    EventBus.on(FishingEvents.CANCELLED, () => this.player.animator.release(), this);
  }

  /**
   * Surfaces loop-content feedback (quests, levels, record catches) through
   * the existing HUD message banner. All read-only listeners — the systems
   * themselves own the logic; this only narrates it to the player.
   */
  private wireLoopContent(): void {
    EventBus.on(
      ProgressionEvents.LEVEL_UP,
      (p: { skill: string; level: number }) => {
        const skill = p.skill.charAt(0).toUpperCase() + p.skill.slice(1);
        this.hud.notifications.push(`${skill} Level ${p.level}!`, 'success');
      },
      this
    );
    EventBus.on(
      QuestEvents.COMPLETED,
      (q: { name: string; reward: { gold?: number } }) => {
        const goldPart = q.reward.gold ? ` (+${q.reward.gold}g)` : '';
        this.hud.notifications.push(`Quest complete: ${q.name}${goldPart}`, 'success');
        this.uiSound.playQuestComplete();
        spawnParticleBurst(this, this.player.x, this.player.y - 18);
      },
      this
    );
    EventBus.on(
      QuestEvents.STARTED,
      (q: { name: string; summary: string }) => this.hud.notifications.push(`Quest Accepted: ${q.name} — ${q.summary}`, 'info'),
      this
    );
    EventBus.on(
      JournalEvents.RECORDED,
      (r: { fish: { name: string }; isRecord: boolean; weightKg: number }) => {
        if (r.isRecord) {
          this.hud.notifications.push(`New record! ${r.fish.name} ${r.weightKg}kg`, 'info');
        }
      },
      this
    );
    // New species discovered — a notable moment, and a journal-completion
    // nudge when it rounds a milestone.
    EventBus.on(
      JournalEvents.DISCOVERED,
      (fish: { name: string }) => {
        const s = this.journal.stats();
        this.hud.notifications.push(`New fish: ${fish.name}!  (${s.discovered}/${s.totalSpecies})`, 'success');
      },
      this
    );
    // Environment feedback: time-of-day and weather shifts.
    EventBus.on(
      EnvironmentEvents.TIME_CHANGED,
      (t: import('../systems/Environment').TimeOfDay) =>
        this.hud.notifications.push(`${timeOfDayLabel(t)} settles over the water`, 'info'),
      this
    );
    EventBus.on(
      EnvironmentEvents.WEATHER_CHANGED,
      (w: import('../systems/Environment').Weather) =>
        this.hud.notifications.push(`Weather: ${weatherLabel(w)}`, 'info'),
      this
    );
    // Bait selection feedback.
    EventBus.on(
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
      if (ok) this.fishingHUD.flashSystemMessage?.('Game saved');
    });

    keyboard.on('keydown-ESC', () => {
      if (this.hud.pauseOverlay.isOpen) {
        this.resumeFromPause();
      } else {
        this.isPaused = true;
        this.hud.pauseOverlay.show();
      }
    });

    // J toggles the Fish Journal (Phase 7 — accessible from the UI).
    keyboard.on('keydown-J', () => this.toggleJournalPanel());
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
      // 1) Tear down the old world. Village NPCs aren't owned by the Zone,
      // so dispose them here (they belong to the beach and are re-spawned
      // below if we're arriving back on the beach). The dialogue box
      // itself is a generic, reusable HUDScene utility (not zone-specific
      // content), so it persists across zone transitions untouched.
      this.zone.destroy(this);
      this.villageNPCs?.destroy();
      this.villageNPCs = undefined;

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

      // 5) If we've arrived back on the beach and the village was reached,
      // re-populate it (it's a beach-zone fixture).
      if (targetId === 'beach' && this.villageReached) {
        this.spawnVillage();
      }

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
  }

  public update(_time: number, delta: number): void {
    if (this.isPaused) {
      return;
    }

    this.handlePanelToggles();

    // Advance the day cycle + weather (events fire on period/weather change).
    this.environment.update(delta);

    // Drive new systems (no effect on fishing/movement logic).
    this.combat.update();
    this.checkJourneyTriggers();
    this.intro?.update(this.player);

    const anyPanelOpen = this.hud.inventoryPanel.isOpen || this.hud.shopPanel.isOpen || this.hud.journalPanel.isOpen;
    const dialogueOpen = this.intro?.isDialogueOpen ?? false;
    const npcDialogueOpen = this.hud.npcDialogue?.isActive ?? false;
    const anyDialogueOpen = dialogueOpen || npcDialogueOpen;

    // Always consumed every frame regardless of the gating below, so a
    // press that happens to land while a panel/dialogue is open is fully
    // drained here and can never leak into a later frame as a stale,
    // unintended tool-use once the panel closes.
    const useToolPressed = this.inputManager.isUseToolJustPressed();
    const interactPressed = this.inputManager.isInteractJustPressed();

    // Interaction priority:
    //   1. Active UI (panels) — handled by the panels themselves; nothing here.
    //   2. Dialogue — advances on its own input; nothing here either.
    //   3. Interactable object (E) — talk to an NPC.
    //   4. Equipped tool (Left Mouse) — whatever the hotbar has selected.
    //   5. Passive gameplay (movement, below).
    // E and "use tool" are separate signals on purpose — this is the fix
    // for the input-conflict bug where a press meant to attack could fall
    // through into fishing and show a fishing-only message. Each system
    // now only ever responds to the signal that's actually meant for it.
    if (!anyPanelOpen && !anyDialogueOpen) {
      if (interactPressed && this.villageNPCs?.hasInteractable()) {
        const talk = this.villageNPCs.interact();
        if (talk && this.hud.npcDialogue) {
          this.hud.npcDialogue.start(talk.lines.map((text) => ({ speaker: talk.name, text })));
        }
        this.showHintOnce(StoryFlags.HINT_INTERACT_SHOWN, 'E to Interact');
      } else if (interactPressed && this.intro?.hasInteractable()) {
        this.intro.interact();
        this.showHintOnce(StoryFlags.HINT_INTERACT_SHOWN, 'E to Interact');
      } else if (useToolPressed) {
        this.equipment.useEquipped();
      }
    }

    // Hold position while a panel is open or any dialogue is showing —
    // reusing Player's existing drag-to-stop behavior instead of adding
    // any new movement logic. Fishing no longer holds position: walking
    // away while a cast is out is how the player cancels it (below).
    const shouldHoldPosition = anyPanelOpen || anyDialogueOpen;
    const movementIntent = shouldHoldPosition ? { x: 0, y: 0 } : this.inputManager.getMovementIntent();
    if (movementIntent.x !== 0 || movementIntent.y !== 0) {
      this.showHintOnce(StoryFlags.HINT_MOVE_SHOWN, 'WASD to Move');
    }

    // Walking away from a cast cancels it — the rod and line stay out
    // until a catch resolves, the player cancels, or (here) they move.
    if (this.fishingSystem.isActive && (movementIntent.x !== 0 || movementIntent.y !== 0)) {
      this.fishingSystem.cancel();
    }

    // SOFT collision (bushes, tall grass) and sprint both scale movement
    // speed; they stack (sprinting through a bush is faster than walking
    // through one, but still slower than sprinting on open ground).
    const inSoftZone = this.zone.isInSoftZone(this.player.x, this.player.y);
    const sprinting = this.inputManager.isSprintDown();
    const speedMultiplier = (inSoftZone ? 0.55 : 1) * (sprinting ? PLAYER.SPRINT_MULTIPLIER : 1);
    this.player.applyMovement(movementIntent, delta, speedMultiplier);

    this.inputManager.update();
    this.hud.debugOverlay.setFishingState(this.fishingSystem.currentState);
    this.hud.debugOverlay.setEntityCount(this.combat.activeSlimeCount);
    this.fishingHUD.update();
    this.villageNPCs?.update(this.player);
    this.menuButtons?.update();

    // Gated on RECEIVED_ROD so the held-rod icon never appears before the
    // handover sequence actually grants it — showing it earlier would
    // undercut that moment.
    if (this.story.has(StoryFlags.RECEIVED_ROD)) {
      this.heldVisual.setEquippedTool(this.equipment.equippedTool?.id);
      this.heldVisual.update(this.player as unknown as { x: number; y: number }, this.player.animator);
    }
  }

  /**
   * Spatial story triggers along the beach→village route: once the
   * tutorial is done, walking east past a threshold spawns the first slime
   * encounter; reaching the far east "village gate" marks arrival. Both
   * fire once. Purely additive — reads player position, drives new systems.
   *
   * Also handles zone-edge transitions: walking off the appropriate edge of
   * a zone travels to the connected zone (once it's unlocked).
   */
  private checkJourneyTriggers(): void {
    // Beach-only story beats (slime encounter + village arrival).
    if (canonicalZoneId(this.currentZoneId) === 'beach' && this.story.has(StoryFlags.TUTORIAL_DONE)) {
      const slimeGate = this.zone.widthPx * 0.55;
      if (!this.slimeEncounterTriggered && this.player.x >= slimeGate) {
        this.slimeEncounterTriggered = true;
        this.story.setFlag(StoryFlags.FIRST_SLIME);
        this.hud.playerHealthHUD.show();
        // Held much longer than the default toast — this is the player's
        // very first combat encounter and the only explanation of how to
        // fight back, so it needs real reading time, not a quick flash.
        this.fishingHUD.flashSystemMessage('A slime blocks the path! Swing your rod (Click)', 4000);
        this.hasAttemptedFirstSwing = false;
        this.combat.startEncounter([
          { x: this.player.x + 40, y: this.player.y - 6 },
          { x: this.player.x + 54, y: this.player.y + 10 }
        ]);
      }

      const villageGate = this.zone.widthPx * 0.9;
      if (
        !this.villageReached &&
        this.story.has(StoryFlags.FIRST_SLIME) &&
        !this.combat.isActive &&
        this.player.x >= villageGate
      ) {
        this.onReachVillage();
      }
    }

    this.checkZoneEdgeTransitions();
  }

  /**
   * Zone-to-zone travel by walking off a connecting edge. Kept data-light
   * for now (a small hardcoded adjacency for the two playable zones); future
   * zones can graduate this to a connections table in ZoneData. Guarded so
   * it can't fire mid-encounter or before the destination is unlocked.
   */
  private checkZoneEdgeTransitions(): void {
    if (this.combat.isActive || this.fishingSystem.isActive) return;
    const here = canonicalZoneId(this.currentZoneId);

    // Beach east edge → Forest River (once the 'Upriver' quest unlocked it).
    if (here === 'beach' && this.story.isZoneUnlocked('forest-river')) {
      if (this.player.x >= this.zone.widthPx - 6) {
        // Enter forest-river from its west side.
        this.transitionToZone('forest-river', { spawnX: 24, spawnY: this.zone.heightPx / 2 });
      }
    }

    // Forest River west edge → back to the Beach (enter from the east side).
    if (here === 'forest-river') {
      if (this.player.x <= 6) {
        this.transitionToZone('beach', { spawnX: this.zone.widthPx * 0.85, spawnY: this.zone.heightPx / 2 });
      }
    }
  }

  private onEncounterCleared(): void {
    this.fishingHUD.flashSystemMessage('Victory! The path is clear. Onward to the village.');
    this.playerHealth.heal(1);
    // Autosave the milestone to the bound slot (or slot 0 for a fresh Play).
    const slot = this.boundSaveSlot ?? 0;
    SaveSystem.save(slot, this.saveableSystems());
    this.boundSaveSlot = slot;
  }

  private onReachVillage(): void {
    this.villageReached = true;
    this.story.setFlag(StoryFlags.REACHED_VILLAGE);
    this.story.unlockZone('village');
    this.fishingHUD.flashSystemMessage('You reached Riverside Village — a safe haven.');
    // Full heal on reaching the safe zone; autosave arrival.
    this.playerHealth.restoreFull();
    this.spawnVillage();
    const slot = this.boundSaveSlot ?? 0;
    SaveSystem.save(slot, this.saveableSystems());
    this.boundSaveSlot = slot;
  }

  /** Spawn the village residents (shopkeeper/fisherman/villager) near the gate. */
  private spawnVillage(): void {
    if (this.villageNPCs) return;
    const originX = Math.min(this.zone.widthPx - 30, this.player.x + 30);
    const originY = this.player.y;
    this.villageNPCs = new VillageNPCs(this, originX, originY, {
      onOpenShop: () => this.toggleShopPanel()
    });
  }

  /** Close the pause overlay and let gameplay updates resume. */
  private resumeFromPause(): void {
    this.isPaused = false;
    this.hud.pauseOverlay.hide();
  }

  /** The pause menu's "Quit to Menu" — the same autosave + fade behaviour Esc used to do immediately. */
  private quitToMenu(): void {
    if (this.boundSaveSlot !== null) {
      SaveSystem.save(this.boundSaveSlot, this.saveableSystems());
    }
    this.cameras.main.fadeOut(300, 11, 15, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }

  private onPlayerDefeated(): void {
    // Gentle, fair failure: brief fade, respawn at the start with full
    // health, encounter reset. No gold loss in this first slice.
    //
    // Cancel any in-progress cast first — dying while fishing is a real
    // scenario now that fishing no longer freezes movement (a slime can
    // reach the player while they're standing still waiting for a bite).
    // Without this, the bobber/line would stay visible at the old spot
    // after the player respawns elsewhere, and FishingSystem's pending
    // bite/reaction timers would keep running through the death sequence.
    this.fishingSystem.cancel();
    this.player.animator.playDeath();
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const spawn = this.findDrySpawn(this.zone.widthPx / 2, this.zone.heightPx / 2);
      this.player.setPosition(spawn.x, spawn.y);
      this.playerHealth.restoreFull();
      this.slimeEncounterTriggered = false;
      this.player.animator.respawn();
      this.cameras.main.fadeIn(260, 0, 0, 0);
      this.fishingHUD.flashSystemMessage('You wake back on the shore, unharmed.');
    });
  }

  private handlePanelToggles(): void {
    if (this.inputManager.isInventoryToggleJustPressed()) {
      this.toggleInventoryPanel();
    }

    if (this.inputManager.isShopToggleJustPressed()) {
      this.toggleShopPanel();
    }
  }

  // Only one panel at a time, and neither can be opened mid-cast (so the
  // reaction bar is never hidden behind a panel) — but either can always
  // be closed regardless of fishing state.
  private toggleInventoryPanel(): void {
    if (this.hud.shopPanel.isOpen) return;
    if (!this.hud.inventoryPanel.isOpen && this.fishingSystem.isActive) return;
    this.uiSound.playClick();
    this.hud.inventoryPanel.toggle();
  }

  private toggleShopPanel(): void {
    if (this.hud.inventoryPanel.isOpen) return;
    if (!this.hud.shopPanel.isOpen && this.fishingSystem.isActive) return;
    this.uiSound.playClick();
    this.hud.shopPanel.toggle();
  }

  private toggleJournalPanel(): void {
    // Journal can open any time except mid-cast (so the reaction bar isn't
    // hidden); close any other open panel first to keep one-at-a-time.
    if (!this.hud.journalPanel.isOpen) {
      if (this.fishingSystem.isActive) return;
      if (this.hud.inventoryPanel.isOpen) this.hud.inventoryPanel.toggle();
      if (this.hud.shopPanel.isOpen) this.hud.shopPanel.toggle();
    }
    this.uiSound.playClick();
    this.hud.journalPanel.toggle();
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
    this.villageNPCs?.destroy();
    // Loop-content systems.
    this.progression?.destroy();
    this.quests?.destroy();
    this.uiSound?.destroy();
    // HUDScene runs alongside this scene and is never stopped on its own
    // (zone transitions don't touch it — only this scene's own full
    // shutdown should). Stopping it here triggers HUDScene's own
    // SHUTDOWN handler, which destroys every UI element it owns.
    this.scene.stop(SCENE_KEYS.HUD);
    EventBus.off(IntroEvents.HINT, undefined, this);
    EventBus.off(IntroEvents.COMPLETE, undefined, this);
    EventBus.off(CombatEvents.ENCOUNTER_CLEARED, this.onEncounterCleared, this);
    EventBus.off(CombatEvents.PLAYER_ATTACK, undefined, this);
    EventBus.off(CombatEvents.PLAYER_HURT, undefined, this);
    EventBus.off(FishingEvents.CAST, undefined, this);
    EventBus.off(FishingEvents.CATCH_SUCCESS, undefined, this);
    EventBus.off(FishingEvents.CATCH_FAILURE, undefined, this);
    EventBus.off(FishingEvents.CANCELLED, undefined, this);
    EventBus.off(ProgressionEvents.LEVEL_UP, undefined, this);
    EventBus.off(QuestEvents.COMPLETED, undefined, this);
    EventBus.off(QuestEvents.STARTED, undefined, this);
    EventBus.off(JournalEvents.RECORDED, undefined, this);
    EventBus.off(JournalEvents.DISCOVERED, undefined, this);
    EventBus.off(EnvironmentEvents.TIME_CHANGED, undefined, this);
    EventBus.off(EnvironmentEvents.WEATHER_CHANGED, undefined, this);
    EventBus.off(BaitEvents.CHANGED, undefined, this);
  }
}
