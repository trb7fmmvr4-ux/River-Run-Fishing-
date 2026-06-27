# River Run Fishing — Phase 1: World Foundation Art Pack

Version 1.0.0 · 45 assets / 75 frames across 5 categories · ~388 KB total

This is the **foundation art layer** every future zone builds on: terrain,
water, shorelines, nature props, and ambient effects. It is generated
procedurally (Python + PIL, see `_generator/`) into clean, seamless,
palette-cohesive pixel art, then packed into per-category sprite sheets with
a single `manifest.json`.

> **Honest scope note.** These are production-*structured*, cohesive,
> seamlessly-tiling tiles built to the reference sheet's art direction
> (palette, tile sizes, categories) — a genuine, usable foundation that
> drops straight into the game. They are **not** hand-painted to literal
> Sea-of-Stars fidelity; that bar needs a human pixel artist. Everything
> here is laid out for **tile-for-tile replacement** by hand-painted art
> later: keep the same filename/key and frame size, and nothing else has to
> change. The manifest is the contract.

---

## 1. Asset summary

| Category | Assets | Notes |
|---|---|---|
| **Terrain** (8) | grass, tall_grass, dirt, dark_dirt, sand, forest_floor, stone_ground, path | 32×32, seamless |
| **Water** (5) | river, lake, ocean, deep_water, swamp | 32×32, 4-frame looping ripple animation each |
| **Shorelines** (14) | edge_n/s/e/w, corner_ne/nw/se/sw (outer), inner_ne/nw/se/sw, curve_ne/sw | 32×32, sand↔water transition set with foam |
| **Nature** (14) | tree, pine_tree, bush, flower_red/pink/white/purple, mushroom_red/brown, reeds, log, stump, small_rock, large_rock | transparent, sizes vary (see manifest) |
| **Effects** (4) | water_ripple (5f), shore_foam (4f), leaf_particle (6f), ambient_sparkle (4f) | transparent animation strips |

All terrain, water, and shoreline tiles **tile seamlessly** (verified by 3×3
tiling). Objects and effects use transparent backgrounds with soft drop
shadows.

---

## 2. Folder structure

```
assets/art/
  manifest.json              # the single source of truth (see §4)
  terrain/
    terrain_sheet.png        # packed sheet (4 cols)
    grass.png  dirt.png  ...  # individual PNGs (one per asset)
  water/
    water_sheet.png          # packed sheet (1 row per type, 4 frame cols)
    river_0.png river_1.png ... swamp_3.png
  shorelines/
    shorelines_sheet.png
    edge_n.png  corner_ne.png  ...
  nature/
    nature_sheet.png
    tree.png  pine_tree.png  ...
  effects/
    effects_sheet.png
    water_ripple_0.png  ...
  _generator/                # the Python that produced everything (reproducible)
    build_artpack.py core.py terrain.py water.py shorelines.py nature.py effects.py
```

Both packed sheets **and** individual PNGs are provided: use the sheets in
production (fewer texture binds, better mobile performance), or the
individual files for inspection / swapping one asset at a time.

---

## 3. Sprite sheet specifications

- **Source tile size:** 32×32 px. The game world grid is 16 px
  (`WORLD.TILE_SIZE`), and 32→16 downscales cleanly (2:1); 32 px was chosen
  so the "high-detail" look in the reference survives at native and on
  high-DPI mobile screens.
- **Object sizes vary** (e.g. trees 32×48, reeds 20×28, flowers 16×16) — each
  asset's exact size is in the manifest. Trees/pines use a taller canvas so
  the canopy sits above the trunk and the trunk base is the natural anchor.
- **Packing:** each cell is padded by 1 px of transparency to prevent
  bleeding when sampled. Cell size = max asset size in that sheet.
- **Format:** 32-bit RGBA PNG, transparent where appropriate.
- **Palette:** one shared ~80-colour palette across the whole pack (defined
  in `_generator/core.py`), so every asset is colour-cohesive. Water hues are
  deliberately distinct per body type (river/lake/ocean/deep/swamp).
- **Animation:** animated assets store frames left-to-right in their row; the
  manifest lists each frame's rect in play order. Suggested playback ~6–10
  fps for water, ~8 fps for effects.

---

## 4. Asset manifest

`manifest.json` is the integration contract. Shape:

```jsonc
{
  "pack": "River Run Fishing — Phase 1 World Foundation Art Pack",
  "version": "1.0.0",
  "tile_size": 32,
  "categories": {
    "terrain": {
      "sheet": "terrain/terrain_sheet.png",
      "assets": {
        "grass": {
          "sheet": "terrain/terrain_sheet.png",
          "frames": 1,
          "rect": { "x": 1, "y": 1, "w": 32, "h": 32 },
          "size": [32, 32]
        }
        // ...
      }
    },
    "water": {
      "sheet": "water/water_sheet.png",
      "assets": {
        "river": {
          "sheet": "water/water_sheet.png",
          "frames": 4,
          "animation": true,
          "frame_rects": [ {"x":1,"y":1,"w":32,"h":32}, ... ],
          "size": [32, 32]
        }
        // ...
      }
    }
    // shorelines, nature, effects ...
  }
}
```

- **Static asset** → has `rect`, `frames: 1`.
- **Animated asset** → has `animation: true` and `frame_rects` (one per
  frame, in play order).
- Every entry carries `sheet` (which packed file) and `size`.

---

## 5. Integration plan

Designed to be **fully additive** — no gameplay/system file needs to change
to *add* the pack; swapping placeholders to real art happens incrementally,
at the point of use.

**Step 1 — Load the pack (one place).** A ready-made loader is provided at
`src/utils/ArtPack.ts`. In `PreloadScene`:

```ts
// preload()
ArtPack.queue(this);          // queues manifest + 5 sheets

// create()  (after load completes)
ArtPack.register(this);       // slices sheets into addressable textures
```

This registers every asset under a stable key: `art:<category>:<asset>`,
e.g. `art:terrain:grass`, `art:water:river`, `art:nature:pine_tree`.

**Step 2 — Use real art incrementally.** Existing placeholder generation
(`PlaceholderTextures.ts`) can stay as a fallback. Swap one usage at a time —
e.g. point the ground `tileSprite` at `ArtPack.key('terrain', 'grass')`, or
draw water with the `art:water:river` frames — and delete the corresponding
placeholder when ready. Because keys are stable, swapping is a one-line change
per asset and never touches game logic.

**Step 3 — Wire animations where wanted.** For water and effects, create a
Phaser anim from the frames listed in the manifest and play it on the
relevant sprite. (Static usage just uses frame 0.)

### How future zones reuse & expand this

- **Reuse:** the `ZoneDefinition` system (`data/ZoneData.ts`) already drives
  what each zone contains. A zone simply references these foundation keys for
  its ground/water/props — Beach, River, Lake, Swamp, Ocean Pier, etc. all
  draw from this one pack, which is what keeps the world cohesive.
- **Expand:** new biomes add *new* assets in the same categories with the
  same naming/manifest pattern (e.g. `terrain/snow`, `water/marsh`,
  `nature/palm_tree`), or recolour these via Phaser tint for cheap variants.
  The shoreline set is biome-agnostic (sand↔water) and can be recoloured per
  biome.
- **Replace:** any tile can be upgraded to hand-painted art by overwriting
  its PNG (and the sheet) at the same size — the manifest keys and game code
  stay identical.

### Reproducing / regenerating

```bash
cd assets/art/_generator
python3 build_artpack.py        # requires PIL + numpy; rewrites the pack
```

Generation is deterministic (seeded), so a rebuild produces identical output.
