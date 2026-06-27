/**
 * Data-driven fish definitions.
 *
 * Every fish is just data — no behavior. Rarer fish are tuned to have a
 * tighter reactionWindowMs (a harder timing challenge) and a lower weight
 * (less likely to bite), so rarity is felt through difficulty as well as
 * frequency. This table is the only thing that needs to change to add a
 * new fish; nothing else in the fishing system references fish by name.
 */

export type FishRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'exotic';

export interface FishDefinition {
  id: string;
  name: string;
  rarity: FishRarity;
  /** Gold value — not spent by anything yet, reserved for the Economy system. */
  value: number;
  /** Relative weight used for random selection; higher = more common. */
  weight: number;
  /** How long the player has to react to this fish's bite, in ms. */
  reactionWindowMs: number;
  /**
   * Optional content fields (all additive / backward-compatible). Older
   * code that ignores them still works; new systems (journal weight/length,
   * zone-specific spawns, time-of-day) read them when present.
   */
  /** Physical size range [min,max] in kg / cm, for the journal records. */
  weightRangeKg?: [number, number];
  lengthRangeCm?: [number, number];
  /** Zones this fish can appear in. Absent = appears everywhere (legacy). */
  zones?: string[];
  /** Preferred time of day. Absent = any time. */
  timeOfDay?: ('day' | 'night')[];
  /**
   * Weather this fish prefers (e.g. some bite better in rain). Absent = any
   * weather. Used as a soft bias, not a hard gate, so weather adds texture
   * without making fish unobtainable.
   */
  weather?: WeatherPref[];
  /**
   * Bait types this fish prefers. When the player uses a preferred bait the
   * fish is more likely to appear. Absent = no preference.
   */
  preferredBait?: string[];
}

/** Weather values fish can reference (mirrors Environment's Weather). */
export type WeatherPref = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';

export const FISH_TABLE: FishDefinition[] = [
  // --- Beach / starter-area common ---
  { id: 'sunfish', name: 'Sunfish', rarity: 'common', value: 4, weight: 100, reactionWindowMs: 650, weightRangeKg: [0.1, 0.6], lengthRangeCm: [8, 18], zones: ['beach', 'village'] },
  { id: 'river-perch', name: 'River Perch', rarity: 'common', value: 6, weight: 80, reactionWindowMs: 600, weightRangeKg: [0.2, 0.9], lengthRangeCm: [12, 24], zones: ['beach', 'village', 'forest-river'], preferredBait: ['bait_worm'] },
  { id: 'bluegill', name: 'Bluegill', rarity: 'common', value: 5, weight: 85, reactionWindowMs: 620, weightRangeKg: [0.1, 0.5], lengthRangeCm: [9, 20], zones: ['beach', 'village'], preferredBait: ['bait_worm', 'bait_cricket'] },
  { id: 'creek-chub', name: 'Creek Chub', rarity: 'common', value: 5, weight: 78, reactionWindowMs: 610, weightRangeKg: [0.1, 0.4], lengthRangeCm: [8, 16], zones: ['beach', 'forest-river'], weather: ['cloudy', 'rain'] },
  { id: 'smelt', name: 'Smelt', rarity: 'common', value: 4, weight: 70, reactionWindowMs: 660, weightRangeKg: [0.05, 0.25], lengthRangeCm: [6, 14], zones: ['beach'], preferredBait: ['bait_minnow'] },
  { id: 'rudd', name: 'Rudd', rarity: 'common', value: 7, weight: 60, reactionWindowMs: 590, weightRangeKg: [0.2, 1.0], lengthRangeCm: [12, 26], zones: ['beach', 'village'], weather: ['clear'], preferredBait: ['bait_cricket'] },
  { id: 'yellow-perch', name: 'Yellow Perch', rarity: 'common', value: 8, weight: 55, reactionWindowMs: 580, weightRangeKg: [0.2, 1.1], lengthRangeCm: [14, 28], zones: ['beach', 'forest-river'] },
  // --- Forest River common/uncommon ---
  { id: 'brook-trout', name: 'Brook Trout', rarity: 'common', value: 10, weight: 50, reactionWindowMs: 560, weightRangeKg: [0.3, 1.4], lengthRangeCm: [18, 34], zones: ['forest-river'], weather: ['rain', 'cloudy'] },
  { id: 'rainbow-trout', name: 'Rainbow Trout', rarity: 'common', value: 12, weight: 46, reactionWindowMs: 540, weightRangeKg: [0.4, 2.0], lengthRangeCm: [20, 40], zones: ['forest-river'], preferredBait: ['bait_minnow', 'bait_worm'] },
  { id: 'silver-trout', name: 'Silver Trout', rarity: 'uncommon', value: 14, weight: 40, reactionWindowMs: 500, weightRangeKg: [0.5, 2.2], lengthRangeCm: [22, 42], zones: ['beach', 'forest-river'], weather: ['fog'] },
  { id: 'banded-bass', name: 'Banded Bass', rarity: 'uncommon', value: 18, weight: 30, reactionWindowMs: 460, weightRangeKg: [0.6, 2.8], lengthRangeCm: [24, 46], zones: ['beach', 'village'], preferredBait: ['bait_minnow'] },
  { id: 'steelhead', name: 'Steelhead', rarity: 'uncommon', value: 24, weight: 26, reactionWindowMs: 440, weightRangeKg: [1.0, 4.5], lengthRangeCm: [30, 60], zones: ['forest-river'], weather: ['rain', 'storm'] },
  { id: 'walleye', name: 'Walleye', rarity: 'uncommon', value: 26, weight: 22, reactionWindowMs: 430, weightRangeKg: [0.8, 4.0], lengthRangeCm: [28, 58], zones: ['forest-river'], timeOfDay: ['night'] },
  { id: 'cutthroat', name: 'Cutthroat Trout', rarity: 'uncommon', value: 22, weight: 24, reactionWindowMs: 445, weightRangeKg: [0.7, 3.2], lengthRangeCm: [26, 50], zones: ['forest-river'] },
  { id: 'white-bass', name: 'White Bass', rarity: 'uncommon', value: 20, weight: 28, reactionWindowMs: 455, weightRangeKg: [0.5, 1.8], lengthRangeCm: [22, 40], zones: ['beach', 'forest-river'], preferredBait: ['bait_shiny_lure'] },
  // --- Rare (location-gated, exciting) ---
  { id: 'moonfin-pike', name: 'Moonfin Pike', rarity: 'rare', value: 45, weight: 10, reactionWindowMs: 380, weightRangeKg: [2.0, 7.0], lengthRangeCm: [45, 90], zones: ['beach', 'forest-river'], timeOfDay: ['night'], weather: ['storm'], preferredBait: ['bait_shiny_lure'] },
  { id: 'glassback-eel', name: 'Glassback Eel', rarity: 'rare', value: 55, weight: 7, reactionWindowMs: 340, weightRangeKg: [1.5, 5.0], lengthRangeCm: [50, 110], zones: ['beach'], timeOfDay: ['night'], weather: ['fog'] },
  { id: 'golden-carp', name: 'Golden Carp', rarity: 'rare', value: 60, weight: 6, reactionWindowMs: 360, weightRangeKg: [2.5, 8.0], lengthRangeCm: [40, 80], zones: ['village', 'forest-river'], preferredBait: ['bait_shiny_lure'] },
  { id: 'peacock-bass', name: 'Peacock Bass', rarity: 'rare', value: 65, weight: 6, reactionWindowMs: 350, weightRangeKg: [1.8, 6.0], lengthRangeCm: [35, 70], zones: ['forest-river'], preferredBait: ['bait_shiny_lure'] },
  // --- Legendary / exotic (apex chase) ---
  { id: 'gilded-koi', name: 'Gilded Koi', rarity: 'legendary', value: 140, weight: 2, reactionWindowMs: 260, weightRangeKg: [3.0, 9.0], lengthRangeCm: [45, 85], zones: ['village', 'forest-river'], preferredBait: ['bait_legendary_lure'] },
  { id: 'jade-koi', name: 'Jade Dragon Koi', rarity: 'legendary', value: 165, weight: 1.5, reactionWindowMs: 250, weightRangeKg: [3.5, 10.0], lengthRangeCm: [50, 90], zones: ['forest-river'], preferredBait: ['bait_legendary_lure'] },
  { id: 'phantom-leviathan', name: 'Phantom Leviathan', rarity: 'exotic', value: 400, weight: 0.4, reactionWindowMs: 200, weightRangeKg: [12.0, 40.0], lengthRangeCm: [120, 240], zones: ['beach', 'forest-river'], timeOfDay: ['night'], weather: ['storm', 'fog'], preferredBait: ['bait_legendary_lure'] }
];

/** All zone ids that currently have at least one fish. */
export function zonesWithFish(): string[] {
  const set = new Set<string>();
  for (const f of FISH_TABLE) for (const z of f.zones ?? []) set.add(z);
  return [...set];
}

/** Fish available in a given zone (and optionally time of day). */
export function fishForZone(zoneId: string, time?: 'day' | 'night'): FishDefinition[] {
  return FISH_TABLE.filter((f) => {
    const zoneOk = !f.zones || f.zones.includes(zoneId);
    const timeOk = !time || !f.timeOfDay || f.timeOfDay.includes(time);
    return zoneOk && timeOk;
  });
}

/**
 * Weighted random pick. With no args, picks across the whole table (legacy
 * behaviour, unchanged for existing callers). Optionally pass a zone (and
 * time of day) to pick only from the fish available there.
 */
export function pickRandomFish(zoneId?: string, time?: 'day' | 'night'): FishDefinition {
  return pickFish({ zoneId, time });
}

export interface FishPickContext {
  zoneId?: string;
  time?: 'day' | 'night';
  /** Current weather; biases (does not gate) fish that prefer it. */
  weather?: WeatherPref;
  /** Bait the player is using; biases fish that prefer it. */
  bait?: string;
}

/**
 * Richer fish pick that honours zone + time as a hard filter (same as
 * before) and applies weather + bait as *soft* weight multipliers — a fish
 * that prefers the current weather/bait is more likely, but nothing becomes
 * impossible. This keeps catches varied while making conditions meaningful.
 * Pure and backward-compatible; pickRandomFish delegates here.
 */
export function pickFish(ctx: FishPickContext): FishDefinition {
  const pool = ctx.zoneId ? fishForZone(ctx.zoneId, ctx.time) : FISH_TABLE;
  const table = pool.length > 0 ? pool : FISH_TABLE;

  const effectiveWeight = (fish: FishDefinition): number => {
    let w = fish.weight;
    if (ctx.weather && fish.weather && fish.weather.includes(ctx.weather)) w *= 2.0;
    if (ctx.bait && fish.preferredBait && fish.preferredBait.includes(ctx.bait)) w *= 2.5;
    return w;
  };

  const totalWeight = table.reduce((sum, fish) => sum + effectiveWeight(fish), 0);
  let roll = Math.random() * totalWeight;

  for (const fish of table) {
    roll -= effectiveWeight(fish);
    if (roll <= 0) {
      return fish;
    }
  }

  // Floating-point safety net; only reachable due to rounding at the tail end.
  return table[table.length - 1];
}

/** Roll a concrete weight/length for a caught fish, for journal records. */
export function rollFishMeasurements(fish: FishDefinition): { weightKg: number; lengthCm: number } {
  const [wMin, wMax] = fish.weightRangeKg ?? [0.1, 1.0];
  const [lMin, lMax] = fish.lengthRangeCm ?? [10, 30];
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    weightKg: round2(wMin + Math.random() * (wMax - wMin)),
    lengthCm: Math.round(lMin + Math.random() * (lMax - lMin))
  };
}
