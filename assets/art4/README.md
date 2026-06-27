## River Run Fishing — Phase 4: Buildings, UI & Expansion Foundation Pack

Version 1.0.0 · 49 assets / 71 frames across 5 categories · ~400 KB total

The **progression-support** layer: the structures a settlement is built
from, the furniture that fills a customizable lodge, a UI kit that matches
the game's existing HUD exactly, the celebratory effects for big moments,
and a **reserved structure** for future content. Generated procedurally
(Python + PIL, see `_generator/`).

> **Honest scope note (consistent with Phases 1–3).** Cohesive,
> production-*structured* pixel art built to the reference's direction — a
> real, usable foundation, not hand-painted Sea-of-Stars fidelity. Buildings
> are assembled from reusable parts (wall/roof/window/door) so new structures
> compose easily; UI uses the game's **exact** HUD colours so it sits
> seamlessly with current panels. Everything is laid out for tile-for-tile
> replacement by a human artist, with the manifest as the contract.

---

### 1. Asset summary

**Buildings (12)** — `village_house_brown` / `_blue` / `_green` (peaked
shingle roofs, plank walls, framed windows, chimneys), `shop` (awning +
hanging sign), `fishing_hut` (stilts + net), `dock` (pier over water), the
**lodge components** `lodge_wall` / `lodge_roof` / `lodge_door` /
`lodge_window` (modular, for the buildable lodge), `storage_crate`,
`market_stall` (canopy + goods).

**Lodge decoration (8)** — `bed`, `table`, `chair`, `lantern` (glowing),
`trophy_display`, and three `fish_mount_*` (bass / trout / legendary) on
wooden plaques for trophy walls.

**UI (21)** — split into three sub-sheets:
- **Icons (11):** `icon_inventory`, `icon_cooler`, `icon_gold`,
  `icon_journal`, `icon_shop`, `icon_fish`, `icon_hook`, `icon_star`,
  `icon_heart`, `icon_settings`, `icon_info` — each 16×16 with a dark
  outline for readability on any background.
- **Button states (6):** `button_normal`, `button_hover`, `button_pressed`,
  `button_disabled`, `button_confirm`, `button_danger` — 32×16, bevelled.
- **Panel backgrounds (4):** `panel_default`, `panel_shop`, `panel_journal`,
  `panel_info` — 24×24 nine-slice sources.

**Visual effects (4, animated)** — `legendary_catch` (gold/pink burst, 6f),
`exotic_catch` (purple/iridescent vortex, 7f — grander than legendary),
`boss_spawn` (red shockwave + rising energy + warning ring, 7f),
`quest_complete` (mint ring + drawing checkmark, 6f). Play once over an event.

**Expansion (reserved, 4 + folders)** — placeholder markers
(`reserved_biome`, `reserved_boss`, `reserved_region`,
`reserved_multiplayer`) plus four empty reserved folders. **Art structure
only — no systems.**

---

### 2. Asset manifest

`manifest.json` is the integration contract.

```jsonc
{
  "pack": "River Run Fishing — Phase 4 Buildings, UI & Expansion Foundation Pack",
  "version": "1.0.0",
  "categories": {
    "buildings": { "sheet": "buildings/buildings_sheet.png",
                   "assets": { "shop": { "rect": {...}, "frames": 1, "size": [56,50] }, ... } },
    "decor":     { "sheet": "decor/decor_sheet.png", "assets": { ... } },
    "ui": {
      "sheets": { "icons": "ui/ui_icons_sheet.png",
                  "buttons": "ui/ui_buttons_sheet.png",
                  "panels": "ui/ui_panels_sheet.png" },
      "assets": { "icon_gold":   { "sheet": "ui/ui_icons_sheet.png",   "group": "icons",   "rect": {...} },
                  "button_normal": { "sheet": "ui/ui_buttons_sheet.png", "group": "buttons", "rect": {...} },
                  "panel_default": { "sheet": "ui/ui_panels_sheet.png",  "group": "panels",  "rect": {...} } }
    },
    "effects": { "sheet": "effects/effects_sheet.png",
                 "assets": { "legendary_catch": { "animation": true, "frames": 6,
                                                  "frame_rects": [...], "size": [32,32] }, ... } },
    "expansion": { "sheet": "expansion/expansion_reserved_sheet.png",
                   "assets": { "reserved_biome": { "rect": {...}, "reserved": true }, ... },
                   "reserved_folders": { "future_biomes": { "path": "...", "description": "...", "reserved": true }, ... },
                   "note": "Reserved art structure only. No systems are implemented for these." }
  }
}
```

- **Static** entries: `rect` + `frames: 1`. UI entries also carry `group`.
- **Effect** entries: `animation: true` + `frame_rects` in play order.
- **Expansion** entries carry `reserved: true`.

---

### 3. Folder structure

```
assets/art4/
  manifest.json
  buildings/  buildings_sheet.png + individuals (village_house_*, shop, dock, lodge_*, ...)
  decor/      decor_sheet.png + individuals (bed, table, lantern, fish_mount_*, ...)
  ui/         ui_icons_sheet.png  ui_buttons_sheet.png  ui_panels_sheet.png + individuals
  effects/    effects_sheet.png + individuals (legendary_catch_0..5, ...)
  expansion/
    expansion_reserved_sheet.png + reserved markers
    reserved/
      future_biomes/      README.txt   (empty, reserved)
      future_bosses/      README.txt
      future_regions/     README.txt
      future_multiplayer/ README.txt
  _generator/  build_phase4.py buildings.py decor.py ui.py effects.py expansion.py core.py
```

`assets/art4/` is **separate from** Phases 1–3, so all four packs are
independent.

---

### 4. UI style guide

The UI kit matches the game's **existing** HUD palette exactly, so new
elements sit seamlessly beside the current panels and gold readout.

**Palette (the canonical values, already used in `src/ui/`):**

| Token | Hex | Use |
|---|---|---|
| Gold | `#f4c170` | primary accents, gold readout, default panel border, normal button |
| Gold dark | `#8a611f` | gold shading / coin engraving |
| Dark | `#0b0f14` | panel fills, text stroke, icon outlines |
| Mint | `#8cffb0` | confirm/positive (sell, buy), shop panel border |
| Red | `#ff5d5d` | danger/negative, hearts, warnings |
| Rare | `#ffd27f` | rare-tier accents |
| Legendary | `#ffb1f4` | legendary-tier accents, journal panel border |
| Exotic | `#ff7ce0` | exotic-tier accents |
| Blue | `#7fd9ff` | info, water/cooler accents, info panel border |
| Slate | `#9fb3c8` | disabled, secondary text |
| White | `#ffffff` | highlights, primary text |

**Conventions:**
- **Icons** are 16×16 with a 1px `Dark` outline so they read on any
  background. Pair an icon with its panel (e.g. `icon_cooler` on
  `panel_default`).
- **Buttons** are 32×16 with a chunky bevel (light top/left highlight, dark
  bottom/right shadow). State mapping: `normal` → idle, `hover` → pointer
  over, `pressed` → active press, `disabled` → not interactable (slate),
  `confirm` → positive actions (mint), `danger` → destructive (red). These
  mirror the colours the existing `InventoryPanel` "Sell All" (gold) and
  `ShopPanel` "Buy" (mint) buttons already use.
- **Panels** are 24×24 nine-slice sources: dark semi-transparent fill
  (~88% alpha, matching the current panels) with a 1px coloured border.
  Border colour signals context — gold (default/inventory), mint (shop),
  legendary-pink (journal), blue (info) — consistent with how the live
  panels are already tinted.
- **Effects** use the rarity colours so the celebration matches the catch:
  legendary = gold/pink, exotic = purple/iridescent (and visibly grander).

This is additive: the live HUD/panels are drawn in code today and are
untouched. These assets are a drop-in skin you can adopt panel-by-panel.

---

### 5. Future expansion plan

**Buildings/decor:** add a new structure by composing the reusable parts in
`_generator/buildings.py` (or a new furniture function in `decor.py`),
register it in the dict, rebuild — the build packs it and updates the
manifest automatically. New roof/wall palettes are one constant each.

**UI:** add an icon/button/panel by adding a function to the matching dict in
`_generator/ui.py`. Stay within the palette table above and the kit remains
cohesive. New panel border colours map naturally to new contexts.

**Effects:** add an event effect (e.g. `level_up`, `rare_catch`) as a new
frame-list function in `_generator/effects.py`.

**Reserved expansion structure (prepared, NOT implemented):** the
`expansion/reserved/` folders give future content an obvious home and naming
pattern — **no systems exist for them yet, by design**:
- `future_biomes/` — mirror the Phase 1 category layout (terrain/water/props)
  for new environments (snow, desert, volcanic…).
- `future_bosses/` — one folder per boss, state-per-row sheets like Phase 3's
  Fish King.
- `future_regions/` — region-specific tilesets, landmarks, decorations.
- `future_multiplayer/` — cosmetic variants, name tags, emotes, shared-space
  props.
Filling these is future content work; the structure simply ensures it slots
in consistently.

**Integration (additive — no gameplay change).** A ready loader is provided
at `src/utils/ArtPack4.ts` (parallel to the earlier packs):

```ts
// PreloadScene.preload()
ArtPack4.queue(this);
// PreloadScene.create()
ArtPack4.register(this);
```

Assets become addressable by stable key: `building:<id>`, `decor:<id>`,
`ui:<id>`, `effect:<id>` (animated, frames `0..n-1` for
`generateFrameNumbers`). Adopt them where you like — e.g. swap a code-drawn
panel for `ui:panel_default`, or play `effect:legendary_catch` on a
legendary catch — one call site at a time, never touching game logic. The
`reserved:*` markers exist only so accidental use is visibly a placeholder.

**Replace with hand-drawn art:** overwrite any sheet/frame at the same size;
manifest keys and game code stay identical.

#### Reproducing

```bash
cd assets/art4/_generator
python3 build_phase4.py     # requires PIL + numpy; deterministic output
```
