/**
 * Data-driven zone definitions.
 *
 * A zone is just data describing one explorable area: its size, what's
 * walkable, where the water is, where fishing is allowed, and which fish
 * live there. Like FishData, this file has zero Phaser dependency — the
 * runtime `Zone` class (world/Zone.ts) reads a definition and builds the
 * actual world + collision from it.
 *
 * Everything here is expressed in tile coordinates (not pixels) so zones
 * are easy to author by hand and stay resolution-independent. Rectangles
 * are the only shape for now; that's enough for the planned zones and
 * keeps authoring trivial. More complex masks can be added later without
 * changing how existing zones are defined.
 *
 * Only a handful of fields are "live" today (size, water, fishing,
 * species). The future-facing fields (enemySpawns, resourceNodes) are
 * declared as optional so zones can carry that data before the systems
 * that consume it exist — nothing reads them yet, by design.
 */

import { FISH_TABLE, fishForZone, type FishDefinition } from './FishData';

/** A rectangle in tile coordinates. */
export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ZoneId =
  | 'beach'
  | 'village'
  | 'forest-river'
  | 'river'
  | 'lake'
  | 'mountain-stream'
  | 'swamp'
  | 'ocean-pier'
  | 'deep-water';

/**
 * Canonical id aliases. `'river'` was the original id for what fish data,
 * quests, and progression now consistently call `'forest-river'`. We keep
 * `'river'` resolvable (so any old save that stored it still loads) but
 * normalize it to the canonical id on the way in.
 */
const ZONE_ID_ALIASES: Record<string, ZoneId> = {
  river: 'forest-river'
};

/** Normalize any (possibly legacy) zone id string to its canonical id. */
export function canonicalZoneId(id: string): ZoneId {
  return (ZONE_ID_ALIASES[id] ?? id) as ZoneId;
}

export interface ZoneDefinition {
  id: ZoneId;
  name: string;

  /** Overall zone size, in tiles. */
  widthInTiles: number;
  heightInTiles: number;

  /** Flat background fill colour behind everything (placeholder for real art). */
  backgroundColor: number;

  /**
   * Water rectangles (blocked terrain). The player cannot walk here, and
   * these are also what the shoreline/fishing checks are derived from.
   */
  water: TileRect[];

  /**
   * Where casting is allowed, as rectangles the *player* can stand in to
   * fish. Usually a shoreline strip adjacent to the water rather than the
   * water itself, so the player fishes from land.
   */
  fishingAreas: TileRect[];

  /**
   * Fish that can be caught in this zone. Defaults to the global table if
   * omitted, so early zones don't all need a bespoke list yet.
   */
  species?: FishDefinition[];

  /** FUTURE: where enemies may spawn. Declared now, consumed later. */
  enemySpawns?: TileRect[];

  /** FUTURE: harvestable resource node positions. Declared now, consumed later. */
  resourceNodes?: TileRect[];

  /**
   * Edges that connect to other zones. When the player crosses one of these
   * edges the JourneyDirector transitions to the named zone. If omitted,
   * JourneyDirector falls back to its legacy hardcoded adjacency list.
   */
  connections?: ZoneConnection[];
}

/** A zone-edge connection declared in zone config. */
export interface ZoneConnection {
  /** Which edge of THIS zone triggers the transition. */
  edge: 'left' | 'right' | 'top' | 'bottom';
  /** Canonical id of the destination zone. */
  toZone: ZoneId;
  /** Player spawn position in the destination zone (in pixels). */
  spawnHint?: { spawnX?: number; spawnY?: number };
  /** If set, the transition is gated on this zone being unlocked. */
  requiresUnlock?: ZoneId;
}

/**
 * The currently-playable zone: the Beach starting area. Its layout
 * intentionally matches the previous hardcoded test world (60x40 tiles,
 * a water strip down the east edge) so adopting the zone system changes
 * nothing the player sees — water just becomes blocked, and the shoreline
 * becomes the place you fish from.
 */
const BEACH: ZoneDefinition = {
  id: 'beach',
  name: 'Driftwood Beach',
  widthInTiles: 60,
  heightInTiles: 40,
  backgroundColor: 0x2b4a33,
  water: [{ x: 46, y: 0, width: 14, height: 40 }],
  fishingAreas: [{ x: 43, y: 0, width: 3, height: 40 }],
  // species omitted → uses the global FISH_TABLE (see resolveSpecies).
  connections: [
    {
      edge: 'right',
      toZone: 'forest-river',
      // Enter forest-river from its west side, centred vertically.
      spawnHint: { spawnX: 24, spawnY: 272 },
      requiresUnlock: 'forest-river'
    }
  ]
};

/**
 * Forest River — the second playable zone (minimal but functional).
 *
 * Unlocked by the 'Upriver' quest. A long river running west→east with a
 * central water channel and shoreline strips on both banks to fish from.
 * Its species list is the subset of the global table tagged for
 * 'forest-river', so its catches differ from the beach (trout, steelhead,
 * peacock bass, jade koi, etc.). Kept intentionally small — future content
 * expands layout, enemies, and resources.
 */
const FOREST_RIVER: ZoneDefinition = {
  id: 'forest-river',
  name: 'Forest River',
  widthInTiles: 80,
  heightInTiles: 34,
  backgroundColor: 0x274a3a,
  water: [{ x: 0, y: 14, width: 80, height: 8 }],
  fishingAreas: [
    { x: 0, y: 11, width: 80, height: 3 },
    { x: 0, y: 22, width: 80, height: 3 }
  ],
  species: fishForZone('forest-river'),
  connections: [
    {
      edge: 'left',
      toZone: 'beach',
      // Enter beach near its east side (where the forest-river gate is),
      // centred vertically. 960 * 0.85 ≈ 816; beach heightPx / 2 = 320.
      spawnHint: { spawnX: 816, spawnY: 320 }
    }
  ]
};

/**
 * Stub definitions for the other planned zones. They are intentionally
 * minimal — enough to prove the structure scales and to be selectable
 * later — and are NOT wired into the game yet. Filling these in (real
 * sizes, water layouts, species) is future content work, not engine work.
 */
const PLANNED_STUBS: ZoneDefinition[] = [
  { id: 'village', name: 'Riverside Village', widthInTiles: 60, heightInTiles: 40, backgroundColor: 0x3a3f2b, water: [], fishingAreas: [] },
  // NOTE: 'river' is now an alias of 'forest-river' (see ZONE_TABLE); this
  // stub entry is retained only to keep PLANNED_STUBS indices stable and is
  // no longer referenced by the table.
  { id: 'river', name: 'Run River (legacy alias)', widthInTiles: 80, heightInTiles: 30, backgroundColor: 0x274a42, water: [{ x: 0, y: 12, width: 80, height: 6 }], fishingAreas: [{ x: 0, y: 9, width: 80, height: 3 }] },
  { id: 'lake', name: 'Still Lake', widthInTiles: 60, heightInTiles: 60, backgroundColor: 0x25414a, water: [{ x: 15, y: 15, width: 30, height: 30 }], fishingAreas: [{ x: 12, y: 15, width: 3, height: 30 }] },
  { id: 'mountain-stream', name: 'Highcut Stream', widthInTiles: 40, heightInTiles: 70, backgroundColor: 0x2e4a4a, water: [{ x: 18, y: 0, width: 4, height: 70 }], fishingAreas: [{ x: 15, y: 0, width: 3, height: 70 }] },
  { id: 'swamp', name: 'Mireveil Swamp', widthInTiles: 60, heightInTiles: 50, backgroundColor: 0x2c3a25, water: [{ x: 20, y: 20, width: 20, height: 20 }], fishingAreas: [{ x: 17, y: 20, width: 3, height: 20 }] },
  { id: 'ocean-pier', name: 'Saltline Pier', widthInTiles: 70, heightInTiles: 50, backgroundColor: 0x223f4a, water: [{ x: 0, y: 25, width: 70, height: 25 }], fishingAreas: [{ x: 0, y: 22, width: 70, height: 3 }] },
  { id: 'deep-water', name: 'The Deepwater', widthInTiles: 80, heightInTiles: 80, backgroundColor: 0x16252e, water: [{ x: 0, y: 0, width: 80, height: 80 }], fishingAreas: [] }
];

const ZONE_TABLE: Record<ZoneId, ZoneDefinition> = {
  beach: BEACH,
  village: PLANNED_STUBS[0],
  'forest-river': FOREST_RIVER,
  // 'river' is the legacy id for forest-river; same definition so any old
  // save or reference still resolves to a valid, identical zone.
  river: FOREST_RIVER,
  lake: PLANNED_STUBS[2],
  'mountain-stream': PLANNED_STUBS[3],
  swamp: PLANNED_STUBS[4],
  'ocean-pier': PLANNED_STUBS[5],
  'deep-water': PLANNED_STUBS[6]
};

/** The zone the game currently boots into. */
export const STARTING_ZONE_ID: ZoneId = 'beach';

export function getZoneDefinition(id: ZoneId | string): ZoneDefinition {
  return ZONE_TABLE[canonicalZoneId(id)];
}

/** A zone's own species list, or the global table as a fallback. */
export function resolveSpecies(zone: ZoneDefinition): FishDefinition[] {
  return zone.species ?? FISH_TABLE;
}
