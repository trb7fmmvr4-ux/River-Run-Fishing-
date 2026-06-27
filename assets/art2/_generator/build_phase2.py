"""
Phase 2 master build — Fishing & Creature Art Pack.

Outputs under assets/art2/<category>/:
  fish/   per-rarity packed sheets + individual PNGs (63 species)
  gear/   packed sheet + individuals (16 gear pieces)
  loot/   packed sheet + individuals (5 loot items)
  creatures/ packed sheet + individuals (animated; 4 creatures)
  manifest.json
"""

from __future__ import annotations
import os, json
from PIL import Image

import sys
sys.path.insert(0, os.path.dirname(__file__))
from fish_render import render_fish
from fish_defs import all_fish
from gear_loot_creatures import GEAR, LOOT, CREATURES

OUT = os.path.join(os.path.dirname(__file__), "..", "river-run-fishing", "assets", "art2")
PACK_VERSION = "1.0.0"
PAD = 1


def ensure(d): os.makedirs(d, exist_ok=True)


def pack_grid(images, columns):
    if not images:
        return None, {}
    cw = max(im.width for _, im in images) + PAD * 2
    ch = max(im.height for _, im in images) + PAD * 2
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGBA", (cw * columns, ch * rows), (0, 0, 0, 0))
    rects = {}
    for i, (name, im) in enumerate(images):
        c = i % columns; r = i // columns
        # center each sprite in its cell so varied sizes align nicely
        x = c * cw + PAD + (cw - 2 * PAD - im.width) // 2
        y = r * ch + PAD + (ch - 2 * PAD - im.height) // 2
        sheet.paste(im, (x, y))
        rects[name] = {"x": x, "y": y, "w": im.width, "h": im.height}
    return sheet, rects


def save_individuals(folder, frames):
    ensure(folder)
    for name, im in frames:
        im.save(os.path.join(folder, name + ".png"))


def build_fish():
    fish = all_fish()
    by_rarity = {}
    for f in fish:
        by_rarity.setdefault(f["rarity"], []).append(f)

    cat_dir = os.path.join(OUT, "fish")
    ensure(cat_dir)
    entries = {}
    sheets = {}
    cols_for = {"common": 6, "uncommon": 5, "rare": 5, "legendary": 5, "exotic": 3}
    for rarity, lst in by_rarity.items():
        images = [(f["id"], render_fish(f)) for f in lst]
        save_individuals(cat_dir, images)
        sheet, rects = pack_grid(images, cols_for.get(rarity, 6))
        sheet_name = f"fish_{rarity}_sheet.png"
        sheet.save(os.path.join(cat_dir, sheet_name))
        sheets[rarity] = f"fish/{sheet_name}"
        for f in lst:
            r = rects[f["id"]]
            entries[f["id"]] = {
                "sheet": f"fish/{sheet_name}",
                "rarity": rarity,
                "name": f["name"],
                "frames": 1,
                "rect": r,
                "size": [r["w"], r["h"]],
            }
    return sheets, entries


def build_static(category, generators, columns):
    cat_dir = os.path.join(OUT, category)
    images = [(n, fn()) for n, fn in generators.items()]
    save_individuals(cat_dir, images)
    sheet, rects = pack_grid(images, columns)
    sheet_name = f"{category}_sheet.png"
    sheet.save(os.path.join(cat_dir, sheet_name))
    entries = {}
    for n, r in rects.items():
        entries[n] = {"sheet": f"{category}/{sheet_name}", "frames": 1, "rect": r, "size": [r["w"], r["h"]]}
    return f"{category}/{sheet_name}", entries


def build_animated(category, generators, columns):
    cat_dir = os.path.join(OUT, category)
    flat = []; groups = {}
    for base, fn in generators.items():
        frames = fn()
        names = []
        for i, im in enumerate(frames):
            cell = f"{base}_{i}"; flat.append((cell, im)); names.append(cell)
        groups[base] = names
    save_individuals(cat_dir, flat)
    sheet, rects = pack_grid(flat, columns)
    sheet_name = f"{category}_sheet.png"
    sheet.save(os.path.join(cat_dir, sheet_name))
    entries = {}
    for base, names in groups.items():
        entries[base] = {
            "sheet": f"{category}/{sheet_name}",
            "frames": len(names),
            "animation": True,
            "frame_rects": [rects[n] for n in names],
            "size": [rects[names[0]]["w"], rects[names[0]]["h"]],
        }
    return f"{category}/{sheet_name}", entries


def main():
    ensure(OUT)
    manifest = {
        "pack": "River Run Fishing — Phase 2 Fishing & Creature Art Pack",
        "version": PACK_VERSION,
        "note": "Procedurally generated fishing ecosystem. 63 fish across 5 "
                "rarity tiers (rarer tiers are larger, more vivid, with glow "
                "and ornate fins so rarity reads at a glance), plus gear, loot "
                "and ambient creatures. Fish are produced by a parametric "
                "renderer from data records — adding a species is one data "
                "row, no renderer change. The 8 fish already in the game's "
                "FishData.ts use their real ids so art maps 1:1.",
        "categories": {},
    }

    fish_sheets, fish_entries = build_fish()
    manifest["categories"]["fish"] = {"sheets_by_rarity": fish_sheets, "assets": fish_entries}

    gsheet, gentries = build_static("gear", GEAR, columns=6)
    manifest["categories"]["gear"] = {"sheet": gsheet, "assets": gentries}

    lsheet, lentries = build_static("loot", LOOT, columns=5)
    manifest["categories"]["loot"] = {"sheet": lsheet, "assets": lentries}

    csheet, centries = build_animated("creatures", CREATURES, columns=3)
    manifest["categories"]["creatures"] = {"sheet": csheet, "assets": centries}

    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    # summary
    counts = {
        "fish": len(fish_entries),
        "gear": len(gentries),
        "loot": len(lentries),
        "creatures": len(centries),
    }
    total = sum(counts.values())
    total_frames = 0
    for c in manifest["categories"].values():
        for a in c["assets"].values():
            total_frames += a.get("frames", 1)
    print(f"Built {total} assets / {total_frames} frames.")
    for k, v in counts.items():
        print(f"  {k:10s} {v}")
    # fish breakdown
    from collections import Counter
    rc = Counter(e["rarity"] for e in fish_entries.values())
    print("  fish by rarity:", dict(rc))


if __name__ == "__main__":
    main()
