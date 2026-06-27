import Phaser from 'phaser';
import { ArtRegistry } from '../utils/AssetRegistry';

export type PlayerPose = 'idle' | 'walk' | 'run' | 'cast' | 'reel' | 'attack' | 'hurt' | 'death';
export type Direction = 'down' | 'up' | 'left' | 'right';

const POSES: PlayerPose[] = ['idle', 'walk', 'run', 'cast', 'reel', 'attack', 'hurt', 'death'];
const DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right'];

/** Frames per second per pose — tuned by feel, not by any external data. */
const FRAME_RATE: Record<PlayerPose, number> = {
  idle: 4,
  walk: 8,
  run: 11,
  cast: 10,
  reel: 9,
  attack: 13,
  hurt: 9,
  death: 6
};

/** Which poses loop continuously vs. play once and report completion. */
const LOOPING: Record<PlayerPose, boolean> = {
  idle: true,
  walk: true,
  run: true,
  cast: false,
  reel: false,
  attack: false,
  hurt: false,
  death: false
};

/** Minimum speed (px/s) before walk/run animation kicks in, below which the player reads as idle. */
const MOVE_THRESHOLD = 4;
/** Speed (px/s) above which walk becomes run — matched loosely to PLAYER.MAX_SPEED in GameConfig. */
const RUN_THRESHOLD = 70;

/**
 * Animation state machine for the player character.
 *
 * Built as a separate class — not folded into Player.ts — so movement
 * logic and animation/presentation logic stay independently testable and
 * so future equipment/visual layers can attach here without touching
 * Player's physics code at all. This is the "framework future art can
 * plug into" the brief asked for: every pose+direction combination that
 * exists in the art pack gets a Phaser animation built once at
 * construction; anything missing is silently skipped (falls back to
 * whatever frame was last showing), so partial art never breaks anything.
 *
 * If the real player art isn't loaded at all (textures absent — e.g. an
 * asset failed to load), every method here becomes a safe no-op and the
 * existing placeholder rendering is completely unaffected. This can only
 * ever add visuals on top of working movement, never change it.
 *
 * One-shot poses (cast/reel/attack/hurt/death) lock out movement-driven
 * animation until they finish, reported via Phaser's own animation-
 * complete event — guarded by a short defensive timeout as well, so a
 * missed event can never leave the player stuck mid-animation.
 *
 * Every state-changing entry point (a one-shot starting, playAndHold,
 * playDeath, release, respawn) bumps a `generation` counter. Each
 * one-shot's pending release closure captures the generation it was
 * started under and checks it before actually clearing the lock — so if
 * a NEWER animation has since taken over (e.g. the player gets hit mid-
 * attack, or dies mid-cast), the OLDER one-shot's leftover timer/listener
 * can never prematurely release a lock that now belongs to something
 * else. This is a general fix for the whole class of "two animations
 * overlapping" bugs, not a special case for any one combination.
 */
export class PlayerAnimator {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly hasRealArt: boolean;
  private direction: Direction = 'down';
  private locked = false;
  private dead = false;
  /** Bumped by every state-changing call; invalidates stale pending releases from a previous, now-superseded animation. */
  private generation = 0;

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite) {
    this.sprite = sprite;
    this.hasRealArt = scene.textures.exists(ArtRegistry.player('idle', 'down'));

    if (this.hasRealArt) {
      this.buildAnimations(scene);
      this.play('idle', 'down', true);
    }
  }

  /** True if real player art is loaded and animations are active (vs. the placeholder fallback). */
  public get isAnimated(): boolean {
    return this.hasRealArt;
  }

  /** Current facing direction — read by HeldEquipmentVisual to position an overlay icon. */
  public get currentDirection(): Direction {
    return this.direction;
  }

  /**
   * True while the active pose already depicts the equipped tool as part
   * of its own art (cast/reel/attack all show the rod/weapon in-hand) —
   * so a separate held-item overlay icon should hide rather than
   * double-render alongside it. False during idle/walk/run, where the
   * base character art doesn't depict anything in-hand.
   */
  public get poseShowsHeldItem(): boolean {
    if (!this.hasRealArt) return false;
    const key = this.sprite.anims.currentAnim?.key ?? '';
    return key.includes('-cast-') || key.includes('-reel-') || key.includes('-attack-');
  }

  private animKey(pose: PlayerPose, dir: Direction): string {
    return `player-${pose}-${dir}`;
  }

  private buildAnimations(scene: Phaser.Scene): void {
    for (const pose of POSES) {
      for (const dir of DIRECTIONS) {
        const texKey = ArtRegistry.player(pose, dir);
        if (!scene.textures.exists(texKey)) continue; // partial art is fine — just skip what's missing

        const key = this.animKey(pose, dir);
        if (scene.anims.exists(key)) continue;

        const tex = scene.textures.get(texKey);
        const total = tex.frameTotal - 1; // minus the implicit __BASE frame
        if (total <= 0) continue;

        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(texKey, { start: 0, end: total - 1 }),
          frameRate: FRAME_RATE[pose],
          repeat: LOOPING[pose] ? -1 : 0
        });
      }
    }
  }

  private play(pose: PlayerPose, dir: Direction, loop: boolean): void {
    if (!this.hasRealArt) return;
    const key = this.animKey(pose, dir);
    if (!this.sprite.scene.anims.exists(key)) return; // that pose/direction had no art — stay on current frame

    const current = this.sprite.anims.currentAnim;
    if (current?.key === key && this.sprite.anims.isPlaying) return; // already playing; avoid restarting every frame
    this.sprite.play({ key, repeat: loop ? -1 : 0 }, true);
  }

  /**
   * Drive idle/walk/run + facing direction from current velocity. Call
   * every frame from the same place movement is applied. No-ops while a
   * one-shot pose (cast/reel/attack/hurt) or death is in progress, so
   * those poses can't be interrupted by ordinary movement updates.
   */
  /**
   * Face a direction directly, independent of movement — e.g. turning to
   * face an NPC during dialogue while standing still. Respects the same
   * lock as movement-driven facing (won't fight a one-shot pose or death).
   */
  public faceDirection(dir: Direction): void {
    if (!this.hasRealArt || this.locked || this.dead) return;
    this.direction = dir;
    this.play('idle', dir, true);
  }

  public updateMovement(vx: number, vy: number): void {
    if (!this.hasRealArt || this.locked || this.dead) return;

    const speed = Math.hypot(vx, vy);
    if (speed > MOVE_THRESHOLD) {
      this.direction = this.directionFromVelocity(vx, vy);
      this.play(speed > RUN_THRESHOLD ? 'run' : 'walk', this.direction, true);
    } else {
      this.play('idle', this.direction, true);
    }
  }

  private directionFromVelocity(vx: number, vy: number): Direction {
    // Dominant axis decides facing — natural for a 4-direction rig and
    // avoids flicker on near-diagonal movement.
    if (Math.abs(vx) > Math.abs(vy)) return vx < 0 ? 'left' : 'right';
    return vy < 0 ? 'up' : 'down';
  }

  /**
   * Run a one-shot pose to completion, then hand control back to
   * movement-driven animation. Defensive timeout (frame count / rate plus
   * a margin) guarantees the lock releases even if the animation-complete
   * event is somehow missed — the player can never get stuck unable to
   * animate because of this.
   */
  private playOneShot(pose: PlayerPose, onComplete?: () => void): void {
    if (!this.hasRealArt || this.dead) return;
    const key = this.animKey(pose, this.direction);
    if (!this.sprite.scene.anims.exists(key)) {
      onComplete?.();
      return;
    }

    const myGeneration = ++this.generation;
    this.locked = true;
    this.sprite.play({ key, repeat: 0 }, true);

    const anim = this.sprite.scene.anims.get(key);
    const estimatedMs = anim ? (anim.frames.length / FRAME_RATE[pose]) * 1000 + 250 : 800;

    const release = () => {
      // A newer animation (another one-shot, a hold, death, etc.) has
      // since taken over — this stale release must not touch its lock.
      if (myGeneration !== this.generation) return;
      this.locked = false;
      onComplete?.();
    };

    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (playedAnim: Phaser.Animations.Animation) => {
      if (playedAnim.key !== key) return;
      release();
    });
    this.sprite.scene.time.delayedCall(estimatedMs, release);
  }

  public playCast(onComplete?: () => void): void {
    this.playOneShot('cast', onComplete);
  }

  /**
   * Play a pose once and HOLD on its final frame — locked — until
   * `release()` is called explicitly, rather than auto-returning to
   * movement-driven animation. Used for the fishing cast: there's no
   * dedicated "standing with rod out" pose in the art rig, so holding the
   * cast animation's last frame is the closest approximation to "the rod
   * stays visibly out while waiting for a bite" without needing new art.
   */
  public playAndHold(pose: PlayerPose): void {
    if (!this.hasRealArt || this.dead) return;
    const key = this.animKey(pose, this.direction);
    if (!this.sprite.scene.anims.exists(key)) return;

    ++this.generation; // invalidates any pending one-shot release from a previous animation
    this.locked = true;
    this.sprite.play({ key, repeat: 0 }, true);
    // No completion listener — repeat:0 naturally stops on the last frame
    // and stays there; the lock is only cleared by release().
  }

  /** Clear a playAndHold() lock and resume movement-driven animation immediately. */
  public release(): void {
    if (this.dead) return;
    ++this.generation;
    this.locked = false;
  }

  public playReel(onComplete?: () => void): void {
    this.playOneShot('reel', onComplete);
  }

  public playAttack(onComplete?: () => void): void {
    this.playOneShot('attack', onComplete);
  }

  /** Hurt reaction — skipped while already dead, so a killing blow doesn't briefly flash "hurt" before death. */
  public playHurt(): void {
    if (this.dead) return;
    this.playOneShot('hurt');
  }

  /** Locks animation on the death pose's last frame until respawn() is called. */
  public playDeath(): void {
    if (!this.hasRealArt || this.dead) return;
    ++this.generation; // invalidates any pending one-shot release from whatever was playing when death struck
    this.dead = true;
    this.locked = true;
    const key = this.animKey('death', this.direction);
    if (this.sprite.scene.anims.exists(key)) {
      this.sprite.play({ key, repeat: 0 }, true);
    }
  }

  /** Clears death/lock state and returns to idle — call after the respawn fade-in. */
  public respawn(): void {
    ++this.generation;
    this.dead = false;
    this.locked = false;
    this.play('idle', this.direction, true);
  }
}
