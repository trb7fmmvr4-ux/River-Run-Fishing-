/**
 * Runtime type guards for SaveData fields.
 *
 * These run BEFORE migration so a corrupt or schema-mismatched save is
 * rejected early with a clear reason, rather than silently producing wrong
 * state after apply(). Each guard is deliberately narrow — it only checks
 * the fields that the migration path and restore() calls actually depend on,
 * so old saves with additional unknown fields are still accepted.
 */

/** Shape of the raw JSON object before migration is applied. */
export interface RawSave {
  version?: unknown;
  savedAt?: unknown;
  gold?: unknown;
  coolerCapacity?: unknown;
  cooler?: unknown;
  [key: string]: unknown;
}

/** Returns true if `obj` is a plain object (not null, array, etc.). */
function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/** Validates the minimum required fields of a raw save object. */
export function isValidRawSave(obj: unknown): obj is RawSave {
  if (!isObject(obj)) return false;
  if (typeof obj.gold !== 'number') return false;
  if (typeof obj.coolerCapacity !== 'number') return false;
  if (!Array.isArray(obj.cooler)) return false;
  return true;
}

/** Validates each entry in the cooler array. */
export function isValidCoolerEntry(entry: unknown): entry is { fishId: string; quantity: number } {
  return isObject(entry) &&
    typeof entry.fishId === 'string' &&
    typeof entry.quantity === 'number' &&
    entry.quantity > 0;
}

/** Validates the optional story block if present. */
export function isValidStoryBlock(
  s: unknown
): s is { flags: string[]; unlockedZones: string[]; rodTier: number } {
  if (!isObject(s)) return false;
  if (!Array.isArray(s.flags) || !s.flags.every((f) => typeof f === 'string')) return false;
  if (!Array.isArray(s.unlockedZones) || !s.unlockedZones.every((z) => typeof z === 'string')) return false;
  if (typeof s.rodTier !== 'number') return false;
  return true;
}

/** Validates a single skill state inside the progression block. */
function isSkillState(s: unknown): s is { level: number; xp: number } {
  return isObject(s) && typeof s.level === 'number' && typeof s.xp === 'number';
}

/** Validates the optional progression block if present. */
export function isValidProgressionBlock(
  p: unknown
): p is { fishing: { level: number; xp: number }; combat: { level: number; xp: number }; crafting: { level: number; xp: number } } {
  if (!isObject(p)) return false;
  return isSkillState(p.fishing) && isSkillState(p.combat) && isSkillState(p.crafting);
}

/**
 * Full structural audit of a raw save object.
 *
 * Returns `null` if valid, or a short human-readable reason string if
 * invalid. Callers can use this to log a precise rejection reason rather
 * than a generic "corrupt save" message.
 */
export function auditRawSave(obj: unknown): string | null {
  if (!isObject(obj)) return 'not an object';
  if (typeof obj.gold !== 'number') return 'gold is not a number';
  if (obj.gold < 0) return 'gold is negative';
  if (typeof obj.coolerCapacity !== 'number' || obj.coolerCapacity < 1) return 'coolerCapacity invalid';
  if (!Array.isArray(obj.cooler)) return 'cooler is not an array';
  for (let i = 0; i < (obj.cooler as unknown[]).length; i++) {
    if (!isValidCoolerEntry((obj.cooler as unknown[])[i])) return `cooler[${i}] is malformed`;
  }
  if (obj.story !== undefined && !isValidStoryBlock(obj.story)) return 'story block is malformed';
  if (obj.progression !== undefined && !isValidProgressionBlock(obj.progression)) return 'progression block is malformed';
  return null;
}
