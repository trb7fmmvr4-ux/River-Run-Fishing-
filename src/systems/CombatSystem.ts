import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';
import { Slime } from '../entities/Slime';
import type { Player } from '../entities/Player';
import type { Health } from '../systems/Health';

export const CombatEvents = {
  /** Player swung the rod. */
  PLAYER_ATTACK: 'combat-player-attack',
  /** An enemy died. Payload: { remaining }. */
  ENEMY_DEFEATED: 'combat-enemy-defeated',
  /** All enemies in the encounter are defeated. */
  ENCOUNTER_CLEARED: 'combat-encounter-cleared',
  /** Player took contact damage. */
  PLAYER_HURT: 'combat-player-hurt'
} as const;

export interface CombatConfig {
  /** Damage the starter rod deals per swing (intentionally weak: 1). */
  rodDamage?: number;
  /** Reach of a rod swing, in px. */
  rodReach?: number;
  /** Cooldown between swings, in ms. */
  swingCooldownMs?: number;
}

/**
 * A small, self-contained combat controller for the first encounter.
 *
 * It owns the slimes for an encounter and wires three interactions, all
 * using systems that already exist:
 *   - rod-as-weapon: when the scene reports an action press, any slime
 *     within reach takes rodDamage (the same press the fishing loop uses
 *     elsewhere; the scene decides which gets it based on context).
 *   - contact damage: Arcade overlap → player Health.damage (respects the
 *     health invulnerability window, so it can't drain in one frame).
 *   - victory: when the last slime dies, fire ENCOUNTER_CLEARED.
 *
 * The rod stays deliberately weak (1 dmg). This adds NO new movement or
 * fishing logic — the scene keeps owning those; combat just reads player
 * position and drives the new Slime/Health systems.
 */
export class CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly playerHealth: Health;
  private readonly slimes: Slime[] = [];
  private readonly group: Phaser.Physics.Arcade.Group;

  private readonly rodDamage: number;
  private readonly rodReach: number;
  private readonly swingCooldownMs: number;
  private lastSwingAt = -9999;
  private cleared = false;
  private active = false;

  constructor(scene: Phaser.Scene, player: Player, playerHealth: Health, config: CombatConfig = {}) {
    this.scene = scene;
    this.player = player;
    this.playerHealth = playerHealth;
    this.rodDamage = config.rodDamage ?? 1;
    this.rodReach = config.rodReach ?? 22;
    this.swingCooldownMs = config.swingCooldownMs ?? 380;

    this.group = scene.physics.add.group();

    // Contact damage: overlap player with slime group.
    scene.physics.add.overlap(player, this.group, (_p: unknown, slimeObj: unknown) => {
      const slime = slimeObj as Slime;
      if (slime.isDead) return;
      const now = scene.time.now;
      const took = this.playerHealth.damage(slime.touchDamage, now, 'slime');
      if (took) {
        EventBus.emit(CombatEvents.PLAYER_HURT);
        this.knockback(slime);
      }
    });
  }

  /** Spawn a slime encounter at the given points. */
  public startEncounter(spawns: { x: number; y: number }[]): void {
    for (const s of spawns) {
      const slime = new Slime(this.scene, { x: s.x, y: s.y });
      this.slimes.push(slime);
      this.group.add(slime);
    }
    this.active = true;
    this.cleared = false;
  }

  /** Called by the scene when an action press should count as a rod swing. */
  public trySwing(): boolean {
    if (!this.active) return false;
    const now = this.scene.time.now;
    if (now - this.lastSwingAt < this.swingCooldownMs) return false;
    this.lastSwingAt = now;

    EventBus.emit(CombatEvents.PLAYER_ATTACK);

    let hitAny = false;
    for (const slime of this.slimes) {
      if (slime.isDead) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, slime.x, slime.y);
      if (dist <= this.rodReach + 8) {
        const killed = slime.hurt(this.rodDamage, now);
        hitAny = true;
        if (killed) this.onSlimeKilled(slime);
      }
    }
    return hitAny;
  }

  /** True if a slime is within rod reach (so the scene can prefer combat over fishing). */
  public hasTargetInReach(): boolean {
    if (!this.active) return false;
    return this.slimes.some(
      (s) => !s.isDead && Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y) <= this.rodReach + 8
    );
  }

  public get isActive(): boolean {
    return this.active && !this.cleared;
  }

  /** Count of slimes still alive in the current encounter (0 if no encounter is active). Used by the debug overlay's entity counter. */
  public get activeSlimeCount(): number {
    return this.slimes.filter((s) => !s.isDead).length;
  }

  private onSlimeKilled(_slime: Slime): void {
    const remaining = this.activeSlimeCount;
    EventBus.emit(CombatEvents.ENEMY_DEFEATED, { remaining });
    if (remaining === 0 && !this.cleared) {
      this.cleared = true;
      this.active = false;
      this.scene.time.delayedCall(400, () => EventBus.emit(CombatEvents.ENCOUNTER_CLEARED));
    }
  }

  private knockback(slime: Slime): void {
    const angle = Phaser.Math.Angle.Between(slime.x, slime.y, this.player.x, this.player.y);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.velocity.x += Math.cos(angle) * 120;
    body.velocity.y += Math.sin(angle) * 120;
    this.scene.cameras.main.shake(120, 0.004);
  }

  /** Per-frame: drive slime AI toward the player. */
  public update(): void {
    if (!this.active) return;
    for (const slime of this.slimes) {
      slime.think(this.player);
    }
  }

  public destroy(): void {
    for (const slime of this.slimes) slime.destroy();
    this.slimes.length = 0;
    this.group.destroy(true);
  }
}
