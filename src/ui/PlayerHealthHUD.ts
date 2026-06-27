import Phaser from 'phaser';
import { DEPTH, UI_THEME } from '../config/GameConfig';
import { createBusSubscription } from '../utils/EventBus';
import { edge } from './ScreenLayout';
import { HealthEvents, type Health } from '../systems/Health';
import { popIn } from './UIAnimations';

const MARGIN = 10;

/**
 * Heart-pip health readout for the player, anchored top-left under the
 * gold readout. Listens only to the player's health channel so enemy
 * damage never flickers it.
 *
 * Pips animate their transitions rather than snapping between filled and
 * empty: a lost pip flashes white and shrinks before settling empty, a
 * gained pip pops in with a small bounce. Discrete hearts don't have a
 * meaningful "tween the number" equivalent the way a continuous bar
 * does, but the per-pip transition is the same idea — nothing changes
 * state instantly with no visual feedback.
 *
 * Lives in HUDScene — fixed screen position, set once, no per-frame
 * positioning needed.
 */
export class PlayerHealthHUD {
  private readonly health: Health;
  private readonly pips: Phaser.GameObjects.Arc[] = [];
  private readonly subscriptions = createBusSubscription();
  private visible = false;
  private lastValue: number;

  constructor(scene: Phaser.Scene, health: Health) {
    this.health = health;
    this.lastValue = health.value;

    for (let i = 0; i < health.maximum; i++) {
      const pos = edge('top-left', MARGIN + 5 + i * 10, MARGIN + 30);
      const pip = scene.add
        .circle(pos.x, pos.y, 3.5, UI_THEME.color.red, 1)
        .setStrokeStyle(1, UI_THEME.color.dark, 0.8)
        .setDepth(DEPTH.HUD_GOLD)
        .setVisible(false);
      this.pips.push(pip);
    }

    this.subscriptions.on(health.eventName(HealthEvents.CHANGED), this.onChanged, this);
  }

  /** Reveal the hearts (called when combat/health becomes relevant). */
  public show(): void {
    this.visible = true;
    this.refresh(false);
  }

  private onChanged(): void {
    if (!this.visible) this.visible = true;
    this.refresh(true);
  }

  private refresh(animate: boolean): void {
    const current = this.health.value;
    const previous = this.lastValue;
    this.lastValue = current;

    this.pips.forEach((pip, i) => {
      pip.setVisible(this.visible);
      const filled = i < current;
      const wasFilled = i < previous;

      if (!animate || filled === wasFilled) {
        pip.setFillStyle(filled ? UI_THEME.color.red : UI_THEME.color.panelEdge, 1);
        return;
      }

      if (!filled && wasFilled) {
        // Lost: flash white, shrink, then settle into the empty state.
        // Bespoke (not the shared popIn/popPulse shapes) — this is a
        // two-stage sequence (shrink, then a separate settle-back tween
        // in its onComplete), not a single pulse or pop.
        pip.setFillStyle(0xffffff, 1);
        pip.scene.tweens.add({
          targets: pip,
          scale: 0.5,
          duration: 160,
          ease: 'Quad.easeIn',
          onComplete: () => {
            pip.setFillStyle(UI_THEME.color.panelEdge, 1);
            pip.scene.tweens.add({ targets: pip, scale: 1, duration: 140, ease: 'Back.easeOut' });
          }
        });
      } else {
        // Gained: pop in with a small bounce — the same shape QuestHUD's
        // show() uses for its title/body, just without the alpha fade.
        pip.setFillStyle(UI_THEME.color.red, 1);
        popIn(pip.scene, pip, { fromScale: 0.4 });
      }
    });
  }

  public destroy(): void {
    this.subscriptions.dispose();
    this.pips.forEach((p) => p.destroy());
  }
}
