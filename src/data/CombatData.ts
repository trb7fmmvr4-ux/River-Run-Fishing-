/**
 * Combat encounter catalogue — pure data, zero Phaser dependency.
 *
 * Each EncounterDef names a set of enemies to spawn, expressed as offsets
 * relative to the trigger position (typically the player's location when
 * the encounter fires). JourneyDirector resolves the offsets to world
 * coordinates at spawn time, so the data stays position-independent and
 * easy to tune without touching the director logic.
 *
 * SlimeDef carries per-enemy overrides; omitted fields fall back to the
 * defaults in Slime's own constructor (hp=3, speed=34, touchDamage=1).
 */

export interface SlimeDef {
  /** Offset from the trigger position, in pixels. */
  dx: number;
  dy: number;
  hp?: number;
  speed?: number;
  touchDamage?: number;
}

export interface EncounterDef {
  readonly id: string;
  readonly enemies: SlimeDef[];
  /** Optional hint message shown when the encounter fires (displayed by JourneyDirector). */
  readonly hintMessage?: string;
  /** Duration in ms to hold the hint (defaults to the FishingHUD's standard toast length). */
  readonly hintDurationMs?: number;
}

export const ENCOUNTERS: Record<string, EncounterDef> = {
  'beach-first-slime': {
    id: 'beach-first-slime',
    enemies: [
      { dx: 40, dy: -6 },
      { dx: 54, dy: 10 }
    ],
    hintMessage: 'A slime blocks the path! Swing your rod (Click)',
    hintDurationMs: 4000
  }
};
