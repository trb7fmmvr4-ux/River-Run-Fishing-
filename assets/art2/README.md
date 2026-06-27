# River Run Fishing — Phase 2: Fishing & Creature Art Pack

Version 1.0.0 · 88 assets / 93 frames across 4 categories · ~496 KB total

The fishing **ecosystem** layer: a full roster of catchable fish, the gear
to catch them, the loot you pull up, and the ambient creatures that make a
zone feel alive. Generated procedurally (Python + PIL, see `_generator/`)
from the same cohesive pipeline as Phase 1.

> **Honest scope note (same as Phase 1).** These are cohesive,
> production-*structured* pixel-art sprites built to the reference sheet's
> direction — a real, usable foundation that drops into the game. The fish
> in particular are produced by a **parametric renderer**: a fish is a data
> record (body shape, fin set, palette, pattern, size, rarity), and the
> renderer turns it into a side-profile sprite. That's deliberate — it's how
> you get 63 fish that are clearly distinct but share one style, and how a
> new species becomes a one-line addition. They are **not** hand-painted to
> literal Sea-of-Stars fidelity; everything is laid out for tile-for-tile
> replacement by a human artist later, with the manifest as the contract.

---

## 1. Asset summary

### Fish — 63 species across 5 rarity tiers

| Tier | Count | Visual language |
|---|---|---|
| **Common** | 30 | earthy/muted palettes, simple patterns, small–medium bodies |
| **Uncommon** | 15 | cooler, cleaner colours, slightly larger, more defined fins |
| **Rare** | 10 | saturated & distinctive, larger bodies, some with subtle glow |
| **Legendary** | 5 | vivid, **glowing outline**, ornate trailing fins, large |
| **Exotic** | 3 | otherworldly palettes, full glow, the apex of the roster |

Rarity is built to **read at a glance** — rarer fish are bigger, more
saturated, and the legendary/exotic tiers carry a glowing dotted outline.
Each fish has a distinct silhouette (8 body shapes: trout, bass, eel, pike,
koi, round/panfish, catfish, leviathan), distinct coloration, and a
consistent rendering style.

**The 8 fish already in `src/data/FishData.ts` use their real ids**
(`sunfish`, `river-perch`, `silver-trout`, `banded-bass`, `moonfin-pike`,
`glassback-eel`, `gilded-koi`, `phantom-leviathan`) so the art maps 1:1 to
game data. The other 55 are new species the data layer can adopt as the
roster grows.

### Gear — 16 pieces
- **Rods (5):** `rod_starter`, `rod_river`, `rod_angler`, `rod_master`,
  `rod_mythic` — a clear visual progression (wood → guided wood → steel →
  blue composite → glowing mythic).
- **Reels (3):** `reel_basic`, `reel_steel`, `reel_gold`.
- **Hooks (3):** `hook_basic`, `hook_steel`, `hook_barbed`.
- **Bobbers (3):** `bobber_classic` (red/white), `bobber_blue`, `bobber_green`.
- **Line (2):** `line_spool`, `line_coil`.

### Loot — 5 items
`ancient_coin`, `rusty_hook`, `rod_fragment`, `treasure_map`, `mystery_box`.

### Ambient creatures — 4 (animated)
`frog` (2f), `bird` (3f), `butterfly` (2f), `dragonfly` (2f).

---

## 2. Sprite sheet specifications

- **Fish:** side-profile, sizes by class — `s` 40×22, `m` 46×24, `l` 54×28,
  `xl` 62×32 px (rarer fish trend larger). Each fish's exact rect is in the
  manifest. One **sheet per rarity** (`fish_common_sheet.png`, …), packed in
  a grid; sprites are centred in their cells so varied sizes align.
- **Gear:** rods on a 32×48 canvas (drawn diagonally, handle bottom-left →
  tip top-right); reels/hooks/bobbers/line on 16×16.
- **Loot:** 16×16.
- **Creatures:** small (12–16 px), stored as horizontal animation strips;
  the manifest lists each frame's rect in play order. Suggested playback
  ~4–6 fps.
- **Format:** 32-bit RGBA PNG, transparent background, soft drop shadows on
  grounded objects.
- **Palette:** shares the Phase 1 palette family (`_generator/core.py`) plus
  fish-specific schemes, so Phase 1 and Phase 2 art sit together cohesively.
- **Packing:** 1 px transparent padding per cell to prevent bleed.

Both packed sheets **and** individual PNGs are provided (sheets for
production, individuals for inspection / single-asset swaps).

---

## 3. Asset manifest

`manifest.json` is the integration contract.

```jsonc
{
  "pack": "River Run Fishing — Phase 2 Fishing & Creature Art Pack",
  "version": "1.0.0",
  "categories": {
    "fish": {
      "sheets_by_rarity": {
        "common": "fish/fish_common_sheet.png",
        "uncommon": "fish/fish_uncommon_sheet.png",
        "rare": "fish/fish_rare_sheet.png",
        "legendary": "fish/fish_legendary_sheet.png",
        "exotic": "fish/fish_exotic_sheet.png"
      },
      "assets": {
        "gilded-koi": {
          "sheet": "fish/fish_legendary_sheet.png",
          "rarity": "legendary",
          "name": "Gilded Koi",
          "frames": 1,
          "rect": { "x": 1, "y": 1, "w": 54, "h": 28 },
          "size": [54, 28]
        }
        // ... 63 fish total
      }
    },
    "gear":      { "sheet": "gear/gear_sheet.png",  "assets": { /* rect per item */ } },
    "loot":      { "sheet": "loot/loot_sheet.png",  "assets": { /* rect per item */ } },
    "creatures": { "sheet": "creatures/creatures_sheet.png",
                   "assets": { "dragonfly": { "animation": true, "frames": 2,
                                              "frame_rects": [ ... ], "size": [16,12] } } }
  }
}
```

- **Fish/gear/loot** entries are static: `rect` + `frames: 1`. Fish entries
  also carry `rarity` and display `name`.
- **Creature** entries are animated: `animation: true` + `frame_rects` in
  play order.
- Every entry carries `sheet` and `size`.

---

## 4. Folder structure

```
assets/art2/
  manifest.json
  fish/
    fish_common_sheet.png  fish_uncommon_sheet.png  fish_rare_sheet.png
    fish_legendary_sheet.png  fish_exotic_sheet.png
    sunfish.png  largemouth-bass.png  gilded-koi.png  ...   (63 individuals)
  gear/
    gear_sheet.png
    rod_starter.png  reel_gold.png  hook_barbed.png  bobber_classic.png  ...
  loot/
    loot_sheet.png
    ancient_coin.png  treasure_map.png  mystery_box.png  ...
  creatures/
    creatures_sheet.png
    frog_0.png frog_1.png  bird_0..2.png  butterfly_0..1.png  dragonfly_0..1.png
  _generator/
    build_phase2.py  fish_render.py  fish_defs.py  gear_loot_creatures.py  core.py
```

`assets/art2/` is **separate from** Phase 1's `assets/art/`, so the two packs
are independent and neither disturbs the other.

---

## 5. Future expansion plan

This pack is built so the roster can grow indefinitely without engine work.

**Add a fish (the common case):** append one record to the appropriate tier
list in `_generator/fish_defs.py` — id, name, shape, pattern, size, palette —
and rebuild. The parametric renderer (`fish_render.py`) handles the rest; no
rendering code changes. 100+ fish is just more rows.

- **New body shapes** (e.g. flatfish, ray, hammerhead) → add one branch to
  `_body_profile` and it becomes available to every future species.
- **New patterns** (e.g. diamond scales, ocelli) → add one branch to
  `_apply_pattern`.
- **Biome-specific variants** → reuse a shape with a recoloured palette, or
  tint at runtime via Phaser for cheap colour variants of an existing fish.

**Gear/loot expansion:** new rod tiers, lures, bait, and loot follow the same
small-function pattern in `gear_loot_creatures.py` and the same manifest
shape — slot them into the existing categories.

**Creatures:** add more ambient species (fish jumping, ducks, fireflies) as
new animation strips in the same category.

**Integration (additive — no gameplay change).** A ready loader is provided
at `src/utils/ArtPack2.ts` (parallel to Phase 1's `ArtPack.ts`):

```ts
// PreloadScene.preload()
ArtPack2.queue(this);
// PreloadScene.create()
ArtPack2.register(this);
```

Assets become addressable by stable keys: `fish:<id>`, `gear:<id>`,
`loot:<id>`, `creature:<id>` — e.g. `fish:gilded-koi`, `gear:rod_starter`.
The existing `FishingHUD` could show `ArtPack2.key('fish', fish.id)` on a
catch; the cooler/journal could show the same key. Because keys are stable
and tied to game ids, wiring real fish art in is a per-call-site change that
never touches game logic.

**Replace with hand-painted art:** overwrite any PNG (and its sheet) at the
same size; manifest keys and game code stay identical.

### Reproducing

```bash
cd assets/art2/_generator
python3 build_phase2.py     # requires PIL + numpy; deterministic output
```
