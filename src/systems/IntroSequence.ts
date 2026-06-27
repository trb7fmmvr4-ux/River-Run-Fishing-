import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';
import { DialogueBox } from '../ui/DialogueBox';
import { FishingEvents } from '../systems/FishingSystem';
import { StoryFlags, type StoryProgress } from '../systems/StoryProgress';
import { ArtRegistry } from '../utils/AssetRegistry';
import { DEPTH, UI_THEME } from '../config/GameConfig';
import { NPCAnimator, type NPCDirection } from '../entities/NPCAnimator';
import { PlaceholderSound } from '../utils/PlaceholderSound';
import type { HotbarHUD } from '../ui/HotbarHUD';
import type { QuestSystem } from '../systems/QuestSystem';

export const IntroEvents = {
  /** Fired when the scripted intro + tutorial are fully complete. */
  COMPLETE: 'intro-complete',
  /** Fired to ask the scene to show a transient tutorial hint. Payload: string. */
  HINT: 'intro-hint'
} as const;

/** Idle lines once the player can freely revisit the fisherman post-tutorial. */
const FISHERMAN_IDLE_LINES = [
  'Good fishing today, traveler.',
  'Mind the slimes past the dunes — a swing of the rod sees them off.',
  'The village folk will have work for a hand like yours.'
];

const INTERACT_RANGE = 26;

/**
 * Scripted beach introduction + fishing tutorial (Phases 2–3).
 *
 * Orchestrates: player wakes on the beach → the old fisherman approaches
 * and speaks → gives a basic rod → guides the player to cast, wait, and
 * catch their first fish → hands off to the journey.
 *
 * It's a self-contained controller that drives the new DialogueBox and
 * StoryProgress and *listens* to the existing fishing EventBus signals
 * (CAST, CATCH_SUCCESS) — it adds no fishing logic and changes nothing in
 * FishingSystem. If the player has already done the intro (loaded save
 * with the TUTORIAL_DONE flag), it no-ops immediately.
 *
 * The fisherman sprite is never destroyed after the scripted beats finish
 * (he stays as a fixture on the beach), so once the tutorial completes he
 * gets the same proximity-prompt + interact treatment as the village NPCs
 * (mirrors VillageNPCs' update/hasInteractable/interact shape so MainScene
 * can route the action key the same way) — a few idle lines instead of
 * standing there inertly forever.
 */
export class IntroSequence {
  private readonly scene: Phaser.Scene;
  private readonly story: StoryProgress;
  private readonly dialogue: DialogueBox;
  private readonly hudScene: Phaser.Scene;
  private readonly hotbar: HotbarHUD;
  private readonly quests: QuestSystem;
  private readonly notifications: { push: (text: string, variant?: 'info' | 'success' | 'warning') => void };
  private readonly sound: PlaceholderSound;
  private readonly player: Phaser.GameObjects.Components.Transform & {
    x: number;
    y: number;
    animator: { faceDirection: (dir: NPCDirection) => void };
  };
  private fisherman?: Phaser.GameObjects.Sprite;
  private fishermanAnimator?: NPCAnimator;
  private prompt?: Phaser.GameObjects.Text;
  private finished = false;
  private nearby = false;
  private glanceTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    story: StoryProgress,
    player: Phaser.GameObjects.Components.Transform & {
      x: number;
      y: number;
      animator: { faceDirection: (dir: NPCDirection) => void };
    },
    hudScene: Phaser.Scene,
    hotbar: HotbarHUD,
    notifications: { push: (text: string, variant?: 'info' | 'success' | 'warning') => void },
    quests: QuestSystem
  ) {
    this.scene = scene;
    this.story = story;
    this.player = player;
    this.hotbar = hotbar;
    this.notifications = notifications;
    this.quests = quests;
    this.sound = new PlaceholderSound();
    // The fisherman sprite/prompt are world-space and stay in MainScene
    // (`scene`); the dialogue box itself is pure screen UI and lives in
    // HUDScene (`hudScene`) — a fixed-position overlay, never zoomed or
    // scrolled, regardless of where MainScene's camera is looking.
    this.dialogue = new DialogueBox(hudScene);
    this.hudScene = hudScene;
  }

  /** Begin the intro. Returns false (and does nothing) if already done. */
  public begin(): boolean {
    if (this.story.has(StoryFlags.TUTORIAL_DONE)) {
      this.finished = true;
      return false;
    }
    this.story.setFlag(StoryFlags.INTRO_STARTED);
    this.spawnFisherman();

    this.dialogue.start(
      [
        { speaker: 'Old Fisherman', text: 'Easy now, traveler. The tide nearly took you.' },
        { speaker: 'Old Fisherman', text: "You've washed up on the shores of a strange world." },
        { speaker: 'Old Fisherman', text: 'Here, every soul lives for one thing — the catch.' },
        { speaker: 'Old Fisherman', text: 'No rod? That simply will not do. Take this one.' }
      ],
      () => this.beginRodHandover()
    );
    this.story.setFlag(StoryFlags.MET_FISHERMAN);
    return true;
  }

  /** Which way the fisherman/player should face to look at each other, from their current relative positions. */
  private facingDirections(): { fishermanFaces: NPCDirection; playerFaces: NPCDirection } {
    if (!this.fisherman) return { fishermanFaces: 'down', playerFaces: 'down' };
    const dx = this.player.x - this.fisherman.x;
    const dy = this.player.y - this.fisherman.y;
    const fishermanFaces: NPCDirection =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    const opposite: Record<NPCDirection, NPCDirection> = { up: 'down', down: 'up', left: 'right', right: 'left' };
    return { fishermanFaces, playerFaces: opposite[fishermanFaces] };
  }

  /**
   * The rod handover choreography (~3–5s total): NPC and player turn to
   * face each other, the fisherman plays a hand-over gesture (a fallback
   * tween, since no dedicated "give item" animation exists in the art —
   * a brief rotate + raised-arm pulse, held 0.35s, exactly as specified
   * for this fallback case), a temporary rod visual travels from his hand
   * to the player's, then a second temporary icon travels from the
   * player into Hotbar Slot 1, which flashes and auto-selects. No
   * fishing/save/economy logic is touched — this is presentation only,
   * layered on top of the existing instant rod-grant call.
   */
  private beginRodHandover(): void {
    this.glanceTimer?.remove();
    const { fishermanFaces, playerFaces } = this.facingDirections();
    this.fishermanAnimator?.setDirection(fishermanFaces);
    this.player.animator.faceDirection(playerFaces);

    const npcX = this.fisherman?.x ?? this.player.x;
    const npcY = (this.fisherman?.y ?? this.player.y) - 16;

    // Hand-over gesture fallback: rotate slightly toward the player and
    // pulse upward (standing in for "raise one arm" — there's no separate
    // arm sprite to animate independently), held for 0.35s per spec.
    if (this.fisherman) {
      const towardSign = playerFaces === 'left' ? -1 : playerFaces === 'right' ? 1 : 0;
      this.scene.tweens.add({
        targets: this.fisherman,
        rotation: 0.12 * (towardSign || 1),
        y: this.fisherman.y - 3,
        duration: 175,
        yoyo: true,
        ease: 'Sine.easeInOut'
      });
    }

    this.scene.time.delayedCall(350, () => this.spawnRodHandoverVisual(npcX, npcY));
  }

  /** Step 6–9: spawn the rod visual at the NPC's hand and tween it to the player. */
  private spawnRodHandoverVisual(npcX: number, npcY: number): void {
    // Simple placeholder rod visual (a short angled bar) — no dedicated
    // item-icon art exists yet for the rod; this reuses the project's
    // established placeholder-shape convention rather than waiting on art.
    const rod = this.scene.add
      .rectangle(npcX, npcY, 3, 18, 0x8a5a32, 1)
      .setRotation(-0.5)
      .setDepth(DEPTH.PLAYER + 2);

    this.scene.tweens.add({
      targets: rod,
      x: this.player.x,
      y: this.player.y - 14,
      rotation: -0.2,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.sound.playReceiveItem();
        this.notifications.push('You received a Fishing Rod', 'success');
        rod.destroy();
        this.animateRodIntoHotbar();
      }
    });
  }

  /** Step 10–13: a temporary icon flies from the player into Hotbar Slot 1, which flashes and auto-equips. */
  private animateRodIntoHotbar(): void {
    const slotPos = this.hotbar.getSlotScreenPosition(0);
    if (!slotPos) {
      // No rendered slot to fly to (shouldn't happen in practice) — still
      // grant the rod and select it, just skip the flourish.
      this.finishRodHandover();
      return;
    }

    // The icon travels in screen space (it's headed for the HUD), so it's
    // created in HUDScene's own coordinate space, not the world scene.
    const startScreen = { x: 240, y: 135 }; // player reads as screen-center under the follow camera; close enough for a short flourish
    const icon = this.hudScene.add
      .text(startScreen.x, startScreen.y, '\u{1F3A3}', { fontSize: '14px' })
      .setOrigin(0.5)
      .setDepth(9000);

    this.hudScene.tweens.add({
      targets: icon,
      x: slotPos.x,
      y: slotPos.y,
      scale: 0.8,
      duration: 450,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        icon.destroy();
        this.hotbar.flashSlot(0, 250);
        this.finishRodHandover();
      }
    });
  }

  /** Step 12–14: auto-equip the rod and return control to the player. */
  private finishRodHandover(): void {
    this.story.setRodTier(1);
    this.story.setFlag(StoryFlags.RECEIVED_ROD);
    this.hotbar.setSelected(0);
    EventBus.emit(IntroEvents.HINT, 'Press 1–9 to Equip');

    this.quests.offerQuestById('q_intro_first_catch');

    this.dialogue.start(
      [{ speaker: 'Old Fisherman', text: 'Stand by the water and cast. Then wait... and feel for the bite.' }],
      () => this.onIntroDialogueDone()
    );
  }

  private spawnFisherman(): void {
    const key = ArtRegistry.npc('old_fisherman', 'idle', 'down');
    // Place the fisherman just beside the player's starting spot.
    const fx = this.player.x + 26;
    const fy = this.player.y;
    if (this.scene.textures.exists(key)) {
      this.fisherman = this.scene.add.sprite(fx, fy, key, 0).setOrigin(0.5, 1).setDepth(DEPTH.PLAYER);
      this.fishermanAnimator = new NPCAnimator(this.scene, this.fisherman, 'old_fisherman');
      this.prompt = this.scene.add
        .text(fx, fy - 38, '[E]', {
          fontFamily: UI_THEME.font.family,
          fontSize: UI_THEME.font.tiny,
          color: UI_THEME.hex.white,
          stroke: UI_THEME.hex.dark,
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.PLAYER + 1)
        .setVisible(false);

      // Occasional look-around so the fisherman reads as alive rather than
      // a painted fixture, using the existing left/right idle frames — no
      // new art required. Stops itself once the sprite is gone.
      this.scheduleNextGlance();
    }
  }

  private scheduleNextGlance(): void {
    if (!this.fisherman || !this.fishermanAnimator) return;
    const delay = Phaser.Math.Between(3500, 7000);
    this.glanceTimer = this.scene.time.delayedCall(delay, () => {
      if (!this.fisherman || !this.fishermanAnimator) return;
      const side = Math.random() < 0.5 ? 'left' : 'right';
      this.fishermanAnimator.glance(side, 500, () => this.scheduleNextGlance());
    });
  }

  private onIntroDialogueDone(): void {
    // "Give" the rod: tier 1, recorded in story state (saved/loaded).
    this.story.setRodTier(1);
    this.story.setFlag(StoryFlags.RECEIVED_ROD);

    EventBus.emit(IntroEvents.HINT, 'Left Click to Cast');

    // Now wait for the player to actually cast, then bite, then catch.
    EventBus.once(FishingEvents.CAST, this.onFirstCast, this);
  }

  private onFirstCast(): void {
    this.story.setFlag(StoryFlags.FIRST_CAST);
    EventBus.emit(IntroEvents.HINT, 'Wait for the bite — then click to hook it!');
    EventBus.once(FishingEvents.CATCH_SUCCESS, this.onFirstCatch, this);
  }

  private onFirstCatch(): void {
    this.story.setFlag(StoryFlags.FIRST_FISH);
    EventBus.emit(IntroEvents.HINT, 'I opens Inventory');
    // Small celebratory beat, then finish the tutorial.
    this.scene.time.delayedCall(900, () => {
      this.dialogue.start(
        [
          { speaker: 'Old Fisherman', text: 'Ha! A natural. The river runs in your blood already.' },
          { speaker: 'Old Fisherman', text: 'Follow the shore path to the village. They will want to meet you.' },
          { speaker: 'Old Fisherman', text: 'Mind the slimes along the way — a firm swing of the rod will see them off.' }
        ],
        () => this.complete()
      );
    });
  }

  private complete(): void {
    if (this.finished) return;
    this.finished = true;
    this.story.setFlag(StoryFlags.TUTORIAL_DONE);
    EventBus.emit(IntroEvents.HINT, 'Head east toward the village');
    EventBus.emit(IntroEvents.COMPLETE);
  }

  public get isActive(): boolean {
    return !this.finished;
  }

  /** True while a dialogue box is on screen (scene should gate fishing input). */
  public get isDialogueOpen(): boolean {
    return this.dialogue.isActive;
  }

  /**
   * Per-frame proximity check for the fisherman's post-tutorial idle
   * interaction. No-ops until the scripted tutorial has finished (so it
   * never competes with the scripted beats) and if the fisherman sprite
   * doesn't exist (e.g. art missing). Mirrors VillageNPCs.update so
   * MainScene's existing action-key routing pattern extends naturally.
   */
  public update(player: Phaser.GameObjects.Components.Transform & { x: number; y: number }): void {
    if (!this.finished || !this.fisherman || !this.prompt) {
      this.nearby = false;
      return;
    }
    const d = Phaser.Math.Distance.Between(player.x, player.y, this.fisherman.x, this.fisherman.y);
    this.nearby = d < INTERACT_RANGE;
    this.prompt.setVisible(this.nearby);
  }

  /** True if the player is close enough to the fisherman to interact. */
  public hasInteractable(): boolean {
    return this.nearby;
  }

  /**
   * Run the fisherman's post-tutorial idle interaction directly through
   * this sequence's own DialogueBox (not the village's — that one isn't
   * created until the player reaches the village, long after the beach).
   * Returns true if it actually said something, so the scene knows the
   * action press was consumed.
   */
  public interact(): boolean {
    if (!this.nearby || this.dialogue.isActive) return false;
    this.glanceTimer?.remove();
    const { fishermanFaces, playerFaces } = this.facingDirections();
    this.fishermanAnimator?.setDirection(fishermanFaces);
    this.player.animator.faceDirection(playerFaces);

    // A small pause before speaking reads as the fisherman noticing the
    // player and turning to address them, rather than firing instantly.
    this.scene.time.delayedCall(220, () => {
      const line = Phaser.Utils.Array.GetRandom(FISHERMAN_IDLE_LINES);
      this.dialogue.start([{ speaker: 'Old Fisherman', text: line }], () => this.scheduleNextGlance());
    });
    return true;
  }

  public destroy(): void {
    EventBus.off(FishingEvents.CAST, this.onFirstCast, this);
    EventBus.off(FishingEvents.CATCH_SUCCESS, this.onFirstCatch, this);
    this.glanceTimer?.remove();
    this.dialogue.destroy();
    this.fisherman?.destroy();
    this.prompt?.destroy();
    this.sound.destroy();
  }
}
