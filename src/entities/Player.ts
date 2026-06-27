import Phaser from 'phaser';
import { PLAYER } from '../config/GameConfig';
import type { MovementIntent } from '../types/GameTypes';
import { PlayerAnimator } from './PlayerAnimator';

/**
 * The player-controlled character.
 *
 * Movement is acceleration-based rather than instant velocity, so input
 * feels smooth and analog — which matters both for keyboard and for the
 * mobile virtual joystick. The entity itself has no idea where its input
 * came from; it just consumes a normalized MovementIntent each frame.
 *
 * Owns a PlayerAnimator (idle/walk/run driven automatically from
 * velocity here; cast/reel/attack/hurt/death triggered externally by
 * whichever system owns that moment — FishingSystem/CombatSystem/Health
 * events, wired in MainScene). If the real player art isn't loaded, the
 * animator is a safe no-op and movement is completely unaffected.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  public readonly animator: PlayerAnimator;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER.SIZE, PLAYER.SIZE);

    // Offset computed from the ACTUAL current frame size, not a hardcoded
    // assumption — this keeps the hitbox centered horizontally and biased
    // toward the lower portion of the frame (where a character's feet are)
    // regardless of whether `texture` is the small placeholder or the
    // larger real character art. For the placeholder's exact dimensions
    // this produces the identical offset Phaser's own setSize()-without-
    // setOffset() auto-centering already gave it, so the existing,
    // working placeholder case is unaffected — verified by direct
    // computation, not just by feel.
    const offsetX = (this.width - PLAYER.SIZE) / 2;
    const offsetY = Math.max(0, this.height - PLAYER.SIZE - 4);
    body.setOffset(offsetX, offsetY);

    this.setCollideWorldBounds(true);

    this.animator = new PlayerAnimator(scene, this);
  }

  /** Apply one frame of movement from a normalized intent vector. */
  public applyMovement(intent: MovementIntent, delta: number, speedMultiplier = 1): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dt = delta / 1000;
    const hasInput = intent.x !== 0 || intent.y !== 0;

    if (hasInput) {
      // Normalize diagonals so moving on two axes isn't faster than one.
      const length = Math.hypot(intent.x, intent.y) || 1;
      const dirX = intent.x / length;
      const dirY = intent.y / length;

      const targetVx = dirX * PLAYER.MAX_SPEED * speedMultiplier;
      const targetVy = dirY * PLAYER.MAX_SPEED * speedMultiplier;
      const lerpFactor = Math.min(1, (PLAYER.ACCELERATION * dt) / PLAYER.MAX_SPEED);

      body.velocity.x = Phaser.Math.Linear(body.velocity.x, targetVx, lerpFactor);
      body.velocity.y = Phaser.Math.Linear(body.velocity.y, targetVy, lerpFactor);

      // The placeholder has no separate left/right frames, so it faces by
      // flipping; the real art rig has explicit per-direction frames
      // (selected by the animator below), so flipping it too would
      // double-mirror and look wrong — only do this in placeholder mode.
      if (dirX !== 0 && !this.animator.isAnimated) {
        this.setFlipX(dirX < 0);
      }
    } else {
      const dragStep = PLAYER.DRAG * dt;
      body.velocity.x = this.dampenToZero(body.velocity.x, dragStep);
      body.velocity.y = this.dampenToZero(body.velocity.y, dragStep);
    }

    this.animator.updateMovement(body.velocity.x, body.velocity.y);
  }

  private dampenToZero(value: number, step: number): number {
    if (Math.abs(value) <= step) return 0;
    return value - Math.sign(value) * step;
  }
}
