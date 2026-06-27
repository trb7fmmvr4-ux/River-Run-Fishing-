import Phaser from 'phaser';
import { DEPTH } from '../config/GameConfig';
import { UIAnchor } from '../ui/UIAnchor';
import type { MovementIntent } from '../types/GameTypes';

const BASE_RADIUS = 38;
const THUMB_RADIUS = 18;
const DEAD_ZONE = 6;
const MARGIN = 24;
const ACTIVATION_MULTIPLIER = 2.2;

/**
 * On-screen analog joystick for touch devices, anchored to the
 * bottom-left of the viewport.
 *
 * Positioned via UIAnchor (the project's single canonical viewport->world
 * transform), deriving the viewport size from the live camera rather than
 * `scene.scale`. The thumb's offset changes continuously while dragging,
 * which doesn't fit a static registration, so this uses UIAnchor directly
 * (computing its own viewport-space origin) rather than UILayout.
 */
export class VirtualJoystick {
  private readonly scene: Phaser.Scene;
  private readonly anchor: UIAnchor;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;
  /** Origin in VIEWPORT space — what pointer coordinates are compared against. */
  private readonly viewportOrigin: Phaser.Math.Vector2;
  /** Thumb offset from origin in viewport space; rendered into world space each frame. */
  private thumbOffset = new Phaser.Math.Vector2(0, 0);
  private pointerId: number | null = null;
  private intent: MovementIntent = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.anchor = new UIAnchor(scene);

    const x = MARGIN + BASE_RADIUS;
    const y = this.anchor.viewport.height - MARGIN - BASE_RADIUS;
    this.viewportOrigin = new Phaser.Math.Vector2(x, y);

    this.base = scene.add.circle(0, 0, BASE_RADIUS, 0xffffff, 0.12);
    this.base.setStrokeStyle(2, 0xffffff, 0.25);
    this.thumb = scene.add.circle(0, 0, THUMB_RADIUS, 0xffffff, 0.35);

    for (const shape of [this.base, this.thumb]) {
      shape.setDepth(DEPTH.TOUCH_CONTROLS);
    }

    this.reposition();
    this.registerInput();
  }

  private registerInput(): void {
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  private withinActivationZone(pointer: Phaser.Input.Pointer): boolean {
    const distance = Phaser.Math.Distance.Between(
      pointer.x,
      pointer.y,
      this.viewportOrigin.x,
      this.viewportOrigin.y
    );
    return distance <= BASE_RADIUS * ACTIVATION_MULTIPLIER;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    if (!this.withinActivationZone(pointer)) return;

    this.pointerId = pointer.id;
    this.updateThumb(pointer.x, pointer.y);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.updateThumb(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;

    this.pointerId = null;
    this.intent = { x: 0, y: 0 };
    this.thumbOffset.set(0, 0);
  }

  private updateThumb(pointerX: number, pointerY: number): void {
    const dx = pointerX - this.viewportOrigin.x;
    const dy = pointerY - this.viewportOrigin.y;
    const distance = Math.hypot(dx, dy);

    if (distance < DEAD_ZONE) {
      this.intent = { x: 0, y: 0 };
      this.thumbOffset.set(0, 0);
      return;
    }

    const clamped = Math.min(distance, BASE_RADIUS);
    const angle = Math.atan2(dy, dx);

    this.thumbOffset.set(Math.cos(angle) * clamped, Math.sin(angle) * clamped);

    this.intent = {
      x: Phaser.Math.Clamp(dx / BASE_RADIUS, -1, 1),
      y: Phaser.Math.Clamp(dy / BASE_RADIUS, -1, 1)
    };
  }

  /** Re-anchor the visuals to the camera via UIAnchor — counter-scaled automatically. */
  private reposition(): void {
    this.anchor.place(this.base, this.viewportOrigin.x, this.viewportOrigin.y);
    this.anchor.place(this.thumb, this.viewportOrigin.x + this.thumbOffset.x, this.viewportOrigin.y + this.thumbOffset.y);
  }

  /** Call once per frame so the joystick stays anchored as the camera scrolls. */
  public update(): void {
    this.reposition();
  }

  public getIntent(): MovementIntent {
    return this.intent;
  }

  public destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.base.destroy();
    this.thumb.destroy();
  }
}
