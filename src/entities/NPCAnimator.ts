import Phaser from 'phaser';
import { ArtRegistry } from '../utils/AssetRegistry';

export type NPCDirection = 'down' | 'up' | 'left' | 'right';
type NPCPose = 'idle' | 'walk';

const DIRECTIONS: NPCDirection[] = ['down', 'up', 'left', 'right'];
const FRAME_RATE: Record<NPCPose, number> = { idle: 3, walk: 7 };

/**
 * Lightweight animation driver for NPC sprites (the fisherman, village
 * residents). Mirrors Slime's animation-building approach exactly — same
 * manifest format, same "skip what's missing" tolerance for partial art —
 * just generalized to any npcId/pose instead of being baked into one enemy
 * class.
 *
 * NPCs only need idle/walk in the art pack (no cast/attack/hurt — they're
 * not player-equivalent), so this is deliberately smaller than
 * PlayerAnimator: no one-shot pose locking, no generation tokens, since
 * there's no scenario here where two NPC animations can overlap or
 * interrupt each other the way player actions can.
 */
export class NPCAnimator {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly npcId: string;
  private readonly hasRealArt: boolean;
  private direction: NPCDirection = 'down';

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, npcId: string) {
    this.sprite = sprite;
    this.npcId = npcId;
    this.hasRealArt = scene.textures.exists(ArtRegistry.npc(npcId, 'idle', 'down'));
    if (this.hasRealArt) {
      this.buildAnimations(scene);
      this.play('idle', 'down');
    }
  }

  public get isAnimated(): boolean {
    return this.hasRealArt;
  }

  private animKey(pose: NPCPose, dir: NPCDirection): string {
    return `npc-${this.npcId}-${pose}-${dir}`;
  }

  private buildAnimations(scene: Phaser.Scene): void {
    const poses: NPCPose[] = ['idle', 'walk'];
    for (const pose of poses) {
      for (const dir of DIRECTIONS) {
        const texKey = ArtRegistry.npc(this.npcId, pose, dir);
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
          repeat: -1
        });
      }
    }
  }

  private play(pose: NPCPose, dir: NPCDirection): void {
    if (!this.hasRealArt) return;
    const key = this.animKey(pose, dir);
    if (!this.sprite.scene.anims.exists(key)) return;
    const current = this.sprite.anims.currentAnim;
    if (current?.key === key && this.sprite.anims.isPlaying) return;
    this.sprite.play(key, true);
  }

  /** Face a direction (and keep whatever pose — idle or walk — is currently playing). */
  public setDirection(dir: NPCDirection): void {
    if (this.direction === dir) return;
    this.direction = dir;
    const wasWalking = this.sprite.anims.currentAnim?.key === this.animKey('walk', this.direction);
    this.play(wasWalking ? 'walk' : 'idle', dir);
  }

  public playIdle(): void {
    this.play('idle', this.direction);
  }

  public playWalk(): void {
    this.play('walk', this.direction);
  }

  /** Briefly glance to one side and back — a cheap, real-art "look around" using the existing left/right idle frames, no new art needed. */
  public glance(toward: 'left' | 'right', holdMs = 500, onDone?: () => void): void {
    if (!this.hasRealArt) {
      onDone?.();
      return;
    }
    const original = this.direction;
    this.setDirection(toward);
    this.sprite.scene.time.delayedCall(holdMs, () => {
      this.setDirection(original);
      onDone?.();
    });
  }
}
