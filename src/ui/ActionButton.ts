import Phaser from 'phaser';
import { DEPTH } from '../config/GameConfig';
import { UILayout } from './UILayout';

const RADIUS = 30;
const MARGIN_X = 28;
const MARGIN_Y = 28;

/**
 * Generic on-screen action button, anchored to the bottom-right of the
 * viewport (mirroring the joystick's bottom-left placement).
 *
 * Positioned via UILayout — registered once against the viewport's
 * bottom-right edge, derived from the camera rather than `scene.scale`.
 * Scale is NOT delegated to the layout's auto zoom-compensation, since
 * the press-squash animation needs to multiply its own factor on top of
 * the zoom counter-scale each frame; `layout.inverseZoom` is used
 * directly for that combination.
 *
 * Carries a small glyph (fishing-pole icon) so its purpose is obvious at
 * a glance rather than being a bare, unlabeled circle. This stays visible
 * on desktop deliberately — Phaser shapes respond to mouse clicks as well
 * as touch, so it doubles as a guaranteed fallback if a keyboard key isn't
 * registering for any reason — so making it self-explanatory matters more
 * than hiding it.
 */
export class ActionButton {
  private readonly scene: Phaser.Scene;
  private readonly layout: UILayout;
  private readonly circle: Phaser.GameObjects.Arc;
  private readonly icon: Phaser.GameObjects.Text;
  private pressed = false;
  private squashScale = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.layout = new UILayout(scene);

    this.circle = scene.add.circle(0, 0, RADIUS, 0xffffff, 0.16);
    this.circle.setStrokeStyle(2, 0xffffff, 0.3);
    this.circle.setDepth(DEPTH.TOUCH_CONTROLS);
    this.circle.setInteractive({ useHandCursor: true });
    this.circle.on('pointerdown', () => this.onPress());

    this.icon = scene.add
      .text(0, 0, '\u{1F3A3}', { fontSize: '20px' }) // fishing pole glyph — what Space/this button does by default
      .setOrigin(0.5)
      .setDepth(DEPTH.TOUCH_CONTROLS + 1)
      .setAlpha(0.85);

    // compensateZoom=false: scale is applied manually via applyScale() so
    // it can combine the zoom counter-scale with the press-squash factor.
    this.layout.addEdge(this.circle, 'bottom-right', MARGIN_X + RADIUS, MARGIN_Y + RADIUS, 0, 0, false);
    this.layout.addEdge(this.icon, 'bottom-right', MARGIN_X + RADIUS, MARGIN_Y + RADIUS, 0, 0, false);
    this.layout.update();
    this.applyScale();
  }

  private onPress(): void {
    this.pressed = true;

    // Immediate tactile feedback — a quick squash driven by a tweened
    // scalar (not the object's scale directly, since applyScale() owns
    // the object's scale each frame to keep it zoom-correct).
    this.scene.tweens.add({
      targets: this,
      squashScale: 0.85,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onUpdate: () => this.applyScale(),
      onComplete: () => {
        this.squashScale = 1;
        this.applyScale();
      }
    });
  }

  private applyScale(): void {
    this.circle.setScale(this.layout.inverseZoom * this.squashScale);
    this.icon.setScale(this.layout.inverseZoom * this.squashScale);
  }

  /** Call once per frame so the button stays anchored as the camera scrolls. */
  public update(): void {
    this.layout.update();
    this.applyScale();
  }

  /** Returns true exactly once per tap, then resets — mirrors keyboard JustDown semantics. */
  public consumePress(): boolean {
    if (!this.pressed) return false;
    this.pressed = false;
    return true;
  }

  public destroy(): void {
    this.circle.destroy();
    this.icon.destroy();
  }
}
