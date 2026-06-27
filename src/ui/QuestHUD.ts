import Phaser from 'phaser';
import { DEPTH, UI_THEME } from '../config/GameConfig';
import { createBusSubscription } from '../utils/EventBus';
import { edge } from './ScreenLayout';
import { QuestEvents } from '../systems/QuestSystem';
import type { QuestSystem } from '../systems/QuestSystem';
import { popIn, popPulse } from './UIAnimations';

const MARGIN = 8;
const FADE_DURATION_MS = 220;

/**
 * A compact on-screen quest tracker (top-right) — tracks exactly ONE
 * quest at a time (the most recently offered active one), not a growing
 * list. Hidden entirely while no quest is active, rather than showing an
 * empty "All done!" placeholder; appears with a small pop-in animation
 * the moment a quest becomes active, and fades back out if it's
 * completed with nothing new to replace it.
 *
 * This was rebuilt after a real browser screenshot showed the tracker
 * listing multiple quests simultaneously from the very start of a new
 * game — not what the opening experience was designed around. Note this
 * is a presentation-only fix: which quests exist and when they're
 * offered (the progression loop) is untouched; this class just decides
 * what to *show* given whatever is active.
 *
 * Purely a readout — it reads the QuestSystem and listens to its events,
 * driving no game logic.
 */
export class QuestHUD {
  private readonly quests: QuestSystem;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly subscriptions = createBusSubscription();
  private visible = false;
  private trackedQuestId: string | null = null;

  constructor(scene: Phaser.Scene, quests: QuestSystem) {
    this.quests = quests;

    const titlePos = edge('top-right', MARGIN, MARGIN + 64);
    this.title = scene.add
      .text(titlePos.x, titlePos.y, 'QUEST', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.tiny,
        color: UI_THEME.hex.gold,
        stroke: UI_THEME.hex.dark,
        strokeThickness: 3
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.HUD_GOLD)
      .setAlpha(0)
      .setVisible(false);

    const bodyPos = edge('top-right', MARGIN, MARGIN + 64 + 10);
    this.body = scene.add
      .text(bodyPos.x, bodyPos.y, '', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.tiny,
        color: UI_THEME.hex.white,
        align: 'right',
        stroke: UI_THEME.hex.dark,
        strokeThickness: 3,
        lineSpacing: 2
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.HUD_GOLD)
      .setAlpha(0)
      .setVisible(false);

    this.subscriptions.on(QuestEvents.CHANGED, this.refresh, this);
    this.subscriptions.on(QuestEvents.PROGRESS, this.refresh, this);
    this.subscriptions.on(QuestEvents.STARTED, this.refresh, this);
    this.subscriptions.on(QuestEvents.COMPLETED, this.refresh, this);
    this.refresh();
  }

  /** The single quest to track: the most recently offered one still active (Map insertion order; see QuestSystem.activeQuests). */
  private currentTracked() {
    const active = this.quests.activeQuests();
    return active.length > 0 ? active[active.length - 1] : null;
  }

  private refresh(): void {
    const tracked = this.currentTracked();

    if (!tracked) {
      this.hide();
      this.trackedQuestId = null;
      return;
    }

    const o = tracked.def.objective;
    const counted = o.type === 'reach' ? '' : ` ${tracked.progress}/${tracked.target}`;
    this.title.setText(tracked.def.name.toUpperCase());
    this.body.setText(`${o.description.replace(/\s*\(\d+\/\d+\)\s*$/, '')}${counted}`);

    const isNewQuest = tracked.def.id !== this.trackedQuestId;
    this.trackedQuestId = tracked.def.id;

    if (!this.visible) {
      this.show();
    } else if (isNewQuest) {
      // A different quest just became the tracked one (the previous one
      // completed) — a quick pop to draw the eye to the swap, same shape
      // GoldHUD's coin uses for "something changed" (see UIAnimations).
      popPulse(this.title.scene, [this.title, this.body], { scale: 1.12 });
    }
  }

  private show(): void {
    this.visible = true;
    this.title.setVisible(true);
    this.body.setVisible(true);
    popIn(this.title.scene, [this.title, this.body], { fromScale: 0.85, withAlpha: true });
  }

  /**
   * Fade-then-hide. Kept bespoke rather than folded into UIAnimations:
   * this is currently the only real call site for this exact shape
   * (fade out, then setVisible(false) on completion) — extracting a
   * shared helper for something used once would be exactly the
   * speculative abstraction this sprint's brief asked to avoid. If a
   * second genuine use shows up (Notifications' own fade-out is a
   * plausible future candidate), that's the right moment to share it.
   */
  private hide(): void {
    if (!this.visible) return;
    this.visible = false;
    const targets = [this.title, this.body];
    this.title.scene.tweens.add({
      targets,
      alpha: 0,
      duration: FADE_DURATION_MS,
      ease: 'Quad.easeIn',
      onComplete: () => targets.forEach((t) => t.setVisible(false))
    });
  }

  public destroy(): void {
    this.subscriptions.dispose();
    this.title.destroy();
    this.body.destroy();
  }
}
