import Phaser from 'phaser';
import { UI_THEME, GAME_WIDTH } from '../../config/GameConfig';
import { PlaceholderSound } from '../../utils/PlaceholderSound';

export type ToastVariant = 'info' | 'success' | 'warning';

interface ActiveToast {
  container: Phaser.GameObjects.Container;
  height: number;
}

/**
 * Lightweight notification (toast) system.
 *
 * One Notifications instance per scene; call `push(text, variant)` to slide
 * a small themed banner in from the top. Multiple toasts stack and reflow
 * as older ones expire, so bursts (e.g. "Game saved", "Rare catch!") don't
 * overlap. Auto-dismisses; styling is variant-driven from UI_THEME.
 *
 * Lives in HUDScene — fixed screen coordinates, set directly whenever a
 * toast is pushed or the stack reflows. No per-frame camera tracking is
 * needed at all, since HUDScene's camera never moves.
 */
export class Notifications {
  private readonly scene: Phaser.Scene;
  private readonly active: ActiveToast[] = [];
  private readonly marginTop = UI_THEME.spacing.sm;
  private readonly gap = UI_THEME.spacing.xs;
  private readonly depth = 5500;
  private readonly sound: PlaceholderSound;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.sound = new PlaceholderSound();
  }

  public push(text: string, variant: ToastVariant = 'info', holdMs = 1800): void {
    this.sound.playNotify();
    const accent = this.accentFor(variant);
    const padX = UI_THEME.spacing.md;
    const padY = UI_THEME.spacing.sm;

    const label = this.scene.add.text(0, 0, text, {
      fontFamily: UI_THEME.font.family,
      fontSize: UI_THEME.font.small,
      color: UI_THEME.hex.white
    });
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    label.setPosition(-w / 2 + padX, -h / 2 + padY);

    const bg = this.scene.add.graphics();
    bg.fillStyle(UI_THEME.color.panel, UI_THEME.panel.fillAlpha);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    bg.lineStyle(UI_THEME.panel.borderWidth, accent, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
    // accent pip on the left edge
    bg.fillStyle(accent, 1);
    bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, 3, h - 8, 1);

    const container = this.scene.add
      .container(GAME_WIDTH / 2, -h, [bg, label])
      .setDepth(this.depth)
      .setAlpha(0);

    const toast: ActiveToast = { container, height: h };
    this.active.push(toast);
    this.relayout();

    this.scene.tweens.add({ targets: container, alpha: 1, duration: 140 });

    this.scene.time.delayedCall(holdMs, () => this.dismiss(toast));
  }

  private dismiss(toast: ActiveToast): void {
    const idx = this.active.indexOf(toast);
    if (idx === -1) return;
    this.active.splice(idx, 1);
    this.scene.tweens.add({
      targets: toast.container,
      alpha: 0,
      duration: 160,
      onComplete: () => toast.container.destroy()
    });
    this.relayout();
  }

  /** Re-stack remaining toasts from the top so gaps close smoothly. Fixed screen coordinates, set directly. */
  private relayout(): void {
    let y = this.marginTop;
    for (const toast of this.active) {
      toast.container.setPosition(GAME_WIDTH / 2, y + toast.height / 2);
      y += toast.height + this.gap;
    }
  }

  private accentFor(variant: ToastVariant): number {
    switch (variant) {
      case 'success':
        return UI_THEME.color.mint;
      case 'warning':
        return UI_THEME.color.red;
      default:
        return UI_THEME.color.gold;
    }
  }

  public destroy(): void {
    for (const toast of this.active) toast.container.destroy();
    this.active.length = 0;
    this.sound.destroy();
  }
}
