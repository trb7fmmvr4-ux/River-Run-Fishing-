import Phaser from 'phaser';
import { DEPTH } from '../config/GameConfig';
import { createBusSubscription } from '../utils/EventBus';
import { edge } from './ScreenLayout';
import { GoldEvents } from '../systems/GoldWallet';
import type { GoldWallet } from '../systems/GoldWallet';
import { StoryEvents } from '../systems/StoryProgress';
import type { StoryProgress } from '../systems/StoryProgress';
import { Tooltip } from './theme/Tooltip';
import { popPulse } from './UIAnimations';

const MARGIN = 10;
const COUNT_DURATION_MS = 450;

/**
 * Always-visible gold readout, anchored to the top-left of the screen.
 *
 * Gold counts up/down smoothly over ~450ms rather than snapping to the
 * new value instantly — a real, displayed-value tween, not just a visual
 * flourish layered on top of an instant text change. The coin icon gives
 * a small pulse on change for extra tactile feedback (the same pulse
 * shape QuestHUD uses for its own "something changed" cue — see
 * UIAnimations.popPulse).
 *
 * Lives in HUDScene, whose camera is never zoomed or scrolled — so this
 * is positioned ONCE, at fixed screen coordinates, with no per-frame
 * recomputation needed at all.
 */
export class GoldHUD {
  private readonly wallet: GoldWallet;
  private readonly story?: StoryProgress;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly coin: Phaser.GameObjects.Arc;
  private readonly subscriptions = createBusSubscription();
  private displayedGold: number;
  private countTween?: Phaser.Tweens.Tween;

  /**
   * `tooltip` is shared, owned by HUDScene — not created here. Every HUD
   * that wants hover text takes the same single Tooltip instance rather
   * than each spawning its own (this project previously had four
   * separate Tooltip instances doing the identical job across different
   * HUDs, none of which could ever be visible at the same time as
   * another — see HUDScene for where the shared one lives, and why).
   */
  constructor(scene: Phaser.Scene, wallet: GoldWallet, tooltip: Tooltip, story?: StoryProgress) {
    this.wallet = wallet;
    this.story = story;
    this.displayedGold = wallet.balance;

    const coinPos = edge('top-left', MARGIN + 5, MARGIN + 7);
    this.coin = scene.add.circle(coinPos.x, coinPos.y, 5, 0xf4c170, 1).setDepth(DEPTH.HUD_GOLD);
    this.coin.setStrokeStyle(1, 0x8a611f, 0.8);

    const textPos = edge('top-left', MARGIN + 14, MARGIN);
    this.goldText = scene.add
      .text(textPos.x, textPos.y, this.goldLabel(this.displayedGold), {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#0b0f14',
        strokeThickness: 3
      })
      .setDepth(DEPTH.HUD_GOLD);

    const hintPos = edge('top-left', MARGIN, MARGIN + 16);
    this.hintText = scene.add
      .text(hintPos.x, hintPos.y, '[I] Cooler  [B] Shop  [J] Journal  [F5] Save  [Esc] Menu', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#bfcbd6',
        stroke: '#0b0f14',
        strokeThickness: 2
      })
      .setDepth(DEPTH.HUD_GOLD)
      .setAlpha(0.85);

    this.coin.setInteractive({ useHandCursor: false });
    tooltip.attach(this.coin, () => `Gold: ${this.wallet.balance}g\nEarned from selling fish.`);
    this.goldText.setInteractive({ useHandCursor: false });
    tooltip.attach(this.goldText, () =>
      this.story ? `Gold: ${this.wallet.balance}g\nRod Tier ${Math.max(1, this.story!.rod || 1)}` : `Gold: ${this.wallet.balance}g`
    );

    this.subscriptions.on(GoldEvents.CHANGED, this.onGoldChanged, this);
    if (this.story) this.subscriptions.on(StoryEvents.CHANGED, this.onStoryChanged, this);
  }

  private goldLabel(amount: number): string {
    const rod = this.story ? `   Rod T${Math.max(1, this.story.rod || 1)}` : '';
    return `${Math.round(amount)}g${rod}`;
  }

  private onGoldChanged(): void {
    const target = this.wallet.balance;
    this.countTween?.stop();
    this.countTween = this.goldText.scene.tweens.add({
      targets: this,
      displayedGold: target,
      duration: COUNT_DURATION_MS,
      ease: 'Quad.easeOut',
      onUpdate: () => this.goldText.setText(this.goldLabel(this.displayedGold))
    });

    popPulse(this.goldText.scene, this.coin);
  }

  private onStoryChanged(): void {
    this.goldText.setText(this.goldLabel(this.displayedGold));
  }

  public destroy(): void {
    this.subscriptions.dispose();
    this.countTween?.stop();
    this.coin.destroy();
    this.goldText.destroy();
    this.hintText.destroy();
  }
}
