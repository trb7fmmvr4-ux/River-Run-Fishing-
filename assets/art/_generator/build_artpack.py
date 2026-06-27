"""
Master build for the Phase 1 World Foundation Art Pack.

Produces, under assets/art/<category>/:
  * one packed sprite sheet PNG per category (terrain, water, shorelines,
    nature, effects)
  * individual PNGs for every asset (so they can be used/inspected singly)
  * a single manifest.json describing every frame's sheet, pixel rect, size,
    and animation grouping.

Run: python3 build_artpack.py
"""

from __future__ import annotations
import os
import json
from PIL import Image

from terrain import TERRAIN
from water import WATER, WATER_FRAMES
from shorelines import SHORELINES
from nature import NATURE
from effects import EFFECTS

OUT_ROOT = os.path.join(os.path.dirname(__file__), "..", "river-run-fishing", "assets", "art")
PACK_VERSION = "1.0.0"
PAD = 1  # transparent padding between packed cells to avoid bleed


def ensure(d):
    os.makedirs(d, exist_ok=True)


def pack_grid(images, columns):
    """Pack a list of (name, PIL.Image) into a grid sheet. Returns (sheet, rects)."""
    if not images:
        return None, []
    cell_w = max(im.width for _, im in images) + PAD * 2
    cell_h = max(im.height for _, im in images) + PAD * 2
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGBA", (cell_w * columns, cell_h * rows), (0, 0, 0, 0))
    rects = {}
    for i, (name, im) in enumerate(images):
        c = i % columns
        r = i // columns
        x = c * cell_w + PAD
        y = r * cell_h + PAD
        sheet.paste(im, (x, y))
        rects[name] = {"x": x, "y": y, "w": im.width, "h": im.height}
    return sheet, rects


def write_individuals(category, frames):
    """frames: list of (filename, image). Writes each to its category dir."""
    cdir = os.path.join(OUT_ROOT, category)
    ensure(cdir)
    for fname, im in frames:
        im.save(os.path.join(cdir, fname + ".png"))


def build_static_category(category, generators, columns):
    """Categories where each entry is a single still image."""
    images = [(name, fn()) for name, fn in generators.items()]
    write_individuals(category, images)
    sheet, rects = pack_grid(images, columns)
    sheet_name = f"{category}_sheet.png"
    sheet.save(os.path.join(OUT_ROOT, category, sheet_name))
    manifest_entries = {}
    for name, rect in rects.items():
        manifest_entries[name] = {
            "sheet": f"{category}/{sheet_name}",
            "frames": 1,
            "rect": rect,
            "size": [rect["w"], rect["h"]],
        }
    return sheet_name, manifest_entries


def build_animated_category(category, generators, columns):
    """Categories where each entry is a list of animation frames."""
    flat = []  # (cellname, image)
    groups = {}  # base -> list of cellnames in order
    for base, fn in generators.items():
        frames = fn()
        names = []
        for i, im in enumerate(frames):
            cell = f"{base}_{i}"
            flat.append((cell, im))
            names.append(cell)
        groups[base] = names
    write_individuals(category, flat)
    sheet, rects = pack_grid(flat, columns)
    sheet_name = f"{category}_sheet.png"
    sheet.save(os.path.join(OUT_ROOT, category, sheet_name))
    manifest_entries = {}
    for base, names in groups.items():
        manifest_entries[base] = {
            "sheet": f"{category}/{sheet_name}",
            "frames": len(names),
            "animation": True,
            "frame_rects": [rects[n] for n in names],
            "size": [rects[names[0]]["w"], rects[names[0]]["h"]],
        }
    return sheet_name, manifest_entries


def main():
    ensure(OUT_ROOT)
    manifest = {
        "pack": "River Run Fishing — Phase 1 World Foundation Art Pack",
        "version": PACK_VERSION,
        "tile_size": 32,
        "note": "Procedurally generated foundation art. 32px source tiles "
                "(downscale cleanly to the 16px world grid). All terrain, "
                "water and shoreline tiles tile seamlessly. Objects & effects "
                "use transparent backgrounds. Designed for tile-for-tile "
                "replacement by hand-painted art using this manifest.",
        "categories": {},
    }

    # Terrain — 8 still tiles, 4 columns
    sname, entries = build_static_category("terrain", TERRAIN, columns=4)
    manifest["categories"]["terrain"] = {"sheet": f"terrain/{sname}", "assets": entries}

    # Water — 5 types x 4 frames, columns = WATER_FRAMES so each row is one type
    sname, entries = build_animated_category("water", WATER, columns=WATER_FRAMES)
    manifest["categories"]["water"] = {"sheet": f"water/{sname}", "assets": entries}

    # Shorelines — 14 still tiles, 4 columns
    sname, entries = build_static_category("shorelines", SHORELINES, columns=4)
    manifest["categories"]["shorelines"] = {"sheet": f"shorelines/{sname}", "assets": entries}

    # Nature — 14 still objects, 5 columns
    sname, entries = build_static_category("nature", NATURE, columns=5)
    manifest["categories"]["nature"] = {"sheet": f"nature/{sname}", "assets": entries}

    # Effects — animated, 6 columns (longest strip is 6 frames)
    sname, entries = build_animated_category("effects", EFFECTS, columns=6)
    manifest["categories"]["effects"] = {"sheet": f"effects/{sname}", "assets": entries}

    with open(os.path.join(OUT_ROOT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    # quick summary to stdout
    total_assets = sum(len(c["assets"]) for c in manifest["categories"].values())
    total_frames = 0
    for c in manifest["categories"].values():
        for a in c["assets"].values():
            total_frames += a.get("frames", 1)
    print(f"Built {total_assets} assets / {total_frames} frames across "
          f"{len(manifest['categories'])} categories.")
    for cat, c in manifest["categories"].items():
        print(f"  {cat:12s} {len(c['assets']):2d} assets -> {c['sheet']}")


if __name__ == "__main__":
    main()
