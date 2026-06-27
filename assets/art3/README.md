# River Run Fishing — Phase 3: Character & Combat Art Pack

Version 1.0.0 · player + 5 NPCs + 5 enemies + 1 boss · 420 animation frames · ~1.9 MB

The **character foundation**: a fully directional, multi-state player, a
village's worth of NPCs, a starter enemy bestiary, and the **Fish King** boss
— all produced by one parametric character renderer (see `_generator/`), so
every future character fits the same visual system by construction.

> **Honest scope note (consistent with Phases 1–2).** These are cohesive,
> production-*structured* animated sprites built to the reference's
> direction. Characters come from a **parametric renderer**: a character is a
> data record (skin, hair, hat, shirt, pants, boots, build) and the renderer
> draws it at a given direction/pose/frame. That's deliberate — it's how you
> get a consistent cast where a new NPC is one data row, and it makes "future
> characters fit the system" literally true. They are **not** hand-animated
> to literal Sea-of-Stars fidelity; everything is laid out for replacement by
> a human artist later, with the manifest as the contract.

---

## 1. Asset summary

### Player — 8 poses × 4 directions
`idle`, `walk`, `run`, `cast`, `reel`, `attack`, `hurt`, `death`, each in
`down` / `up` / `left` / `right`. The fisherman matches the reference: wide-
brim hat, vest, work pants, boots, warm palette. Cast raises the rod; attack
swings a weapon arc on the facing side; hurt flashes white; death drops the
character (hat falls off).

### NPCs — 5 (idle + walk, 4 directions each)
`old_fisherman` (grey-bearded elder, straw hat, blue coat), `villager_a`,
`villager_b`, `merchant` (richer dress), `angler` (fellow fisherman). All are
palette/hat variations of the player rig — same style, individually
recognizable. NPCs get idle + walk (enough for a living village); extending
them to more poses is trivial since they use the player's full renderer.

### Enemies — 5 (idle / move / attack / death each)
`green_slime`, `blue_slime` (hop, angry-face attack, flatten-and-fade death),
`bat`, `cave_bat` (wing-flap, glowing eyes — red vs cyan), `swamp_creature`
(hulking, ridged back, glowing eyes, lunge attack).

### Boss — Fish King (5 states)
`idle` (regal bob), `attack` (maw opens), `charge` (tilts back to telegraph,
then lunges), `special` (glowing aura + swirling energy motes), `defeat`
(rolls over and fades). A large teal fish with a **gold crown**, spiky dorsal
fin, and forked tail.

---

## 2. Sprite sheet specifications

- **Player & NPCs:** 24×32 px frames. One **sheet per pose**; within a sheet,
  **each direction is its own row**, frames run left-to-right. Sprites are
  centred in uniform cells; the ground contact point sits near the cell
  bottom so characters anchor correctly on a ~12 px footprint (matching the
  game's player size).
- **Enemies:** compact frames (16–24 px). One **sheet per enemy**; **each
  state is its own row**, frames left-to-right.
- **Boss:** 48×40 px frames, one sheet, one state per row.
- **Format:** 32-bit RGBA PNG, transparent, soft drop shadows, 1 px cell
  padding to prevent bleed.
- **Palette:** shares the project palette sensibility from Phases 1–2 so the
  cast sits naturally in the world.

Both packed sheets **and** individual frame PNGs are provided (sheets for
production, individuals for inspection / single-frame swaps).

---

## 3. Animation specifications

Suggested playback (all loopable except hurt/death/defeat, which play once):

| Animation | Frames | FPS | Loop |
|---|---|---|---|
| player idle | 4 | 4 | yes |
| player walk | 6 | 10 | yes |
| player run | 6 | 14 | yes |
| player cast | 4 | 12 (then hold last) | no |
| player reel | 4 | 10 | yes (while reeling) |
| player attack | 4 | 14 | no |
| player hurt | 2 | 12 | no |
| player death | 4 | 8 | no (hold last) |
| NPC idle / walk | 4 / 6 | 4 / 8 | yes |
| enemy idle | 4 | 4 | yes |
| enemy move | 4 | 8 | yes |
| enemy attack | 3 | 10 | no |
| enemy death | 4 | 8 | no (hold/﻿despawn) |
| boss idle | 4 | 4 | yes |
| boss attack | 3 | 8 | no |
| boss charge | 3 | 6 (telegraph) | no |
| boss special | 3 | 8 | yes during cast |
| boss defeat | 4 | 6 | no (hold last) |

In Phaser, each registered texture's frames are indexed `0..n-1` in play
order, so an anim is just
`this.anims.create({ key, frames: this.anims.generateFrameNumbers('player:walk:down'), frameRate: 10, repeat: -1 })`.

---

## 4. Folder structure

```
assets/art3/
  manifest.json
  player/
    player_idle_sheet.png  player_walk_sheet.png  ...  (8 pose sheets)
    player_walk_down_0.png ...                          (individual frames)
  npcs/
    old_fisherman_idle_sheet.png  merchant_walk_sheet.png  ...  (10 sheets)
    <id>_<pose>_<dir>_<frame>.png                               (individuals)
  enemies/
    green_slime_sheet.png  bat_sheet.png  ...  (5 sheets, state-per-row)
    green_slime_attack_0.png ...               (individuals)
  boss/
    fish_king_sheet.png                        (state-per-row)
    fish_king_special_0.png ...                (individuals)
  _generator/
    build_phase3.py  character_render.py  enemy_boss_render.py  npc_defs.py  core.py
```

`assets/art3/` is **separate from** Phases 1–2 (`assets/art/`, `assets/art2/`),
so all three packs are independent.

---

## 5. Future expansion plan

Built so the cast can grow without engine work.

**Add an NPC (the common case):** append one record to `_generator/npc_defs.py`
(skin/hair/hat/shirt/pants/boots/hat_style) and rebuild. It automatically gets
the full directional rig. New hat styles (`hood`, `beanie`) or builds
(`tall`, `stout`) are one branch each in `character_render.py` and become
available to every character.

**Add an enemy:** add a small render function in
`_generator/enemy_boss_render.py` returning `{idle, move, attack, death}`
frame lists, register it in `ENEMIES`, rebuild. The build packs it and writes
the manifest automatically.

**Add a boss:** same pattern in `BOSS` with its own state set (idle/attack/
charge/special/defeat, or any states you choose). The manifest captures
whatever states you emit.

**Give NPCs combat/fishing poses later:** NPCs already use the player's full
renderer, so adding `cast`/`attack`/etc. to an NPC is just listing those poses
in the build — no new art code.

**Integration (additive — no gameplay change).** A ready loader is provided at
`src/utils/ArtPack3.ts` (parallel to `ArtPack.ts` / `ArtPack2.ts`):

```ts
// PreloadScene.preload()
ArtPack3.queue(this);
// PreloadScene.create()
ArtPack3.register(this);
```

Frames become addressable as indexed textures by stable key:
`player:<pose>:<dir>`, `npc:<id>:<pose>:<dir>`, `enemy:<id>:<state>`,
`boss:<id>:<state>`. Build a Phaser anim from any of them with
`generateFrameNumbers(key)`. Because keys are stable and tied to ids/poses,
wiring real character art in is a per-call-site change that never touches game
logic. The current `Player` (a single static texture today) can adopt
`player:idle:down` etc. when you choose, one pose at a time.

**Replace with hand-drawn art:** overwrite any sheet/frame at the same size;
manifest keys and game code stay identical.

### Reproducing

```bash
cd assets/art3/_generator
python3 build_phase3.py     # requires PIL + numpy; deterministic output
```
