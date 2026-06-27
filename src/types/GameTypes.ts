/**
 * Shared, engine-agnostic types used across the foundation layer.
 *
 * Gameplay data types (FishData, ItemData, ZoneData, etc.) are deliberately
 * NOT defined yet — they belong to later systems (Fish System, Inventory,
 * Exploration) and will live in their own `src/data/*` modules per the
 * development priority order. Keeping this file focused avoids speculative
 * types that would just need to be reworked once real systems land.
 */

/** Normalized movement intent, regardless of input source (keyboard, touch). */
export interface MovementIntent {
  x: number; // -1..1
  y: number; // -1..1
}
