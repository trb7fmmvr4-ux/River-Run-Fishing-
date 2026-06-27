import { EventBus } from '../utils/EventBus';

export const HealthEvents = {
  /** Payload: { current, max, source } */
  CHANGED: 'health-changed',
  /** Payload: { source } */
  DAMAGED: 'health-damaged',
  /** Payload: none — fired when current reaches 0. */
  DEPLETED: 'health-depleted'
} as const;

/**
 * A small, self-contained health component.
 *
 * Deliberately NOT part of Player — it's a plain logic object an owner can
 * hold, so adding health to the player or an enemy never touches their
 * movement/rendering code. Supports damage with a brief invulnerability
 * window (so a single overlap doesn't drain HP every frame), healing, and
 * full restore on respawn.
 *
 * Events are namespaced per-instance via the optional `channel` so the
 * player's HUD can listen to only the player's health, not every enemy's.
 */
export class Health {
  private current: number;
  private readonly max: number;
  private invulnerableUntil = 0;
  private readonly invulnMs: number;
  private readonly channel: string;

  constructor(max: number, options: { invulnMs?: number; channel?: string } = {}) {
    this.max = max;
    this.current = max;
    this.invulnMs = options.invulnMs ?? 600;
    this.channel = options.channel ?? '';
  }

  public get value(): number {
    return this.current;
  }

  public get maximum(): number {
    return this.max;
  }

  public get isDead(): boolean {
    return this.current <= 0;
  }

  public get fraction(): number {
    return this.max === 0 ? 0 : this.current / this.max;
  }

  /** Is the entity currently in its post-hit invulnerability window? */
  public isInvulnerable(now: number): boolean {
    return now < this.invulnerableUntil;
  }

  /**
   * Apply damage. Respects the invulnerability window: returns false (no
   * damage taken) if still invulnerable. `now` is the scene time in ms.
   */
  public damage(amount: number, now: number, source = 'unknown'): boolean {
    if (amount <= 0 || this.isDead) return false;
    if (this.isInvulnerable(now)) return false;

    this.current = Math.max(0, this.current - amount);
    this.invulnerableUntil = now + this.invulnMs;

    this.emit(HealthEvents.DAMAGED, { source });
    this.emit(HealthEvents.CHANGED, { current: this.current, max: this.max, source });
    if (this.isDead) this.emit(HealthEvents.DEPLETED, {});
    return true;
  }

  public heal(amount: number): void {
    if (amount <= 0 || this.isDead) return;
    this.current = Math.min(this.max, this.current + amount);
    this.emit(HealthEvents.CHANGED, { current: this.current, max: this.max, source: 'heal' });
  }

  /** Full restore (e.g. on respawn at the village). */
  public restoreFull(): void {
    this.current = this.max;
    this.invulnerableUntil = 0;
    this.emit(HealthEvents.CHANGED, { current: this.current, max: this.max, source: 'respawn' });
  }

  private event(base: string): string {
    return this.channel ? `${base}:${this.channel}` : base;
  }

  private emit(base: string, payload: unknown): void {
    EventBus.emit(this.event(base), payload);
  }

  /** Event name for a given base, honoring this instance's channel. */
  public eventName(base: string): string {
    return this.event(base);
  }
}
