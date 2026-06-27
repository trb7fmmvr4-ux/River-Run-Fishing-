import Phaser from 'phaser';
import { DEPTH } from '../config/GameConfig';
import { UIAnchor } from './UIAnchor';

export interface UIButtonOptions {
  /** Fixed viewport-space position of the button's centre. */
  screenX: number;
  screenY: number;
  width: number;
  height: number;
  label: string;
  onPress: () => void;
}

/**
 * A small, reusable, camera-anchored tappable button with a text label.
 *
 * Positioned via UIAnchor, the project's single canonical viewport->world
 * transform, so it works correctly under the zoomed camera on desktop and
 * touch alike. Used for the on-screen menu toggles (Cooler, Shop) that
 * give touch devices a way to open panels the keyboard opens with I/B.
 */
export class UIButton {
  private readonly anchor: UIAnchor;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly viewportX: number;
  private readonly viewportY: number;

  constructor(scene: Phaser.Scene, options: UIButtonOptions) {
    this.anchor = new UIAnchor(scene);
    this.viewportX = options.screenX;
    this.viewportY = options.screenY;

    this.background = scene.add
      .rectangle(0, 0, options.width, options.height, 0x0b0f14, 0.7)
      .setDepth(DEPTH.HUD_GOLD)
      .setStrokeStyle(1, 0xf4c170, 0.7)
      .setInteractive({ useHandCursor: true });

    this.label = scene.add
      .text(0, 0, options.label, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD_GOLD);

    this.background.on('pointerdown', () => {
      options.onPress();
      scene.tweens.add({
        targets: this.background,
        alpha: 0.4,
        duration: 70,
        yoyo: true
      });
    });

    this.reposition();
  }

  /** Update the label text (e.g. to reflect open/closed state). */
  public setLabel(text: string): void {
    this.label.setText(text);
  }

  private reposition(): void {
    this.anchor.place(this.background, this.viewportX, this.viewportY);
    this.anchor.place(this.label, this.viewportX, this.viewportY);
  }

  /** Call once per frame so the button stays anchored as the camera scrolls. */
  public update(): void {
    this.reposition();
  }

  public destroy(): void {
    this.background.destroy();
    this.label.destroy();
  }
}
