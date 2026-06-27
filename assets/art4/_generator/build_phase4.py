"""
Phase 4 master build — Buildings, UI & Expansion Foundation Pack.

Output under assets/art4/:
  buildings/  packed sheet + individuals
  decor/      packed sheet + individuals
  ui/         icons sheet, buttons sheet, panels sheet + individuals
  effects/    packed animation sheet + individuals
  expansion/  reserved placeholder markers + reserved/<future_*> folders
  manifest.json
"""

from __future__ import annotations
import os, json
from PIL import Image
import sys
sys.path.insert(0, os.path.dirname(__file__))

from buildings import BUILDINGS
from decor import DECOR
from ui import ICONS, BUTTONS, PANELS
from effects import EFFECTS
from expansion import EXPANSION, RESERVED_FOLDERS

OUT = os.path.join(os.path.dirname(__file__), "..", "river-run-fishing", "assets", "art4")
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
        x = c * cw + PAD + (cw - 2 * PAD - im.width) // 2
        y = r * ch + PAD + (ch - 2 * PAD - im.height) // 2
        sheet.paste(im, (x, y))
        rects[name] = {"x": x, "y": y, "w": im.width, "h": im.height}
    return sheet, rects


def save_individuals(folder, named):
    ensure(folder)
    for name, im in named:
        im.save(os.path.join(folder, name + ".png"))


def build_static(category, generators, columns, subsheet=None):
    cat_dir = os.path.join(OUT, category)
    images = [(n, fn()) for n, fn in generators.items()]
    save_individuals(cat_dir, images)
    sheet_name = f"{subsheet or category}_sheet.png"
    sheet, rects = pack_grid(images, columns)
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
    sheet_name = f"{category}_sheet.png"
    sheet, rects = pack_grid(flat, columns)
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


def build_ui():
    """UI has three sub-sheets: icons, buttons, panels."""
    cat_dir = os.path.join(OUT, "ui"); ensure(cat_dir)
    result = {"sheets": {}, "assets": {}}
    for sub, gens, cols in [("icons", ICONS, 6), ("buttons", BUTTONS, 3), ("panels", PANELS, 4)]:
        images = [(n, fn()) for n, fn in gens.items()]
        save_individuals(cat_dir, images)
        sheet_name = f"ui_{sub}_sheet.png"
        sheet, rects = pack_grid(images, cols)
        sheet.save(os.path.join(cat_dir, sheet_name))
        result["sheets"][sub] = f"ui/{sheet_name}"
        for n, r in rects.items():
            result["assets"][n] = {
                "sheet": f"ui/{sheet_name}", "group": sub, "frames": 1,
                "rect": r, "size": [r["w"], r["h"]],
            }
    return result


def build_expansion():
    """Reserved placeholder markers + empty reserved folders with READMEs."""
    cat_dir = os.path.join(OUT, "expansion"); ensure(cat_dir)
    images = [(n, fn()) for n, fn in EXPANSION.items()]
    save_individuals(cat_dir, images)
    sheet_name = "expansion_reserved_sheet.png"
    sheet, rects = pack_grid(images, 4)
    sheet.save(os.path.join(cat_dir, sheet_name))
    entries = {n: {"sheet": f"expansion/{sheet_name}", "frames": 1, "rect": r,
                   "size": [r["w"], r["h"]], "reserved": True} for n, r in rects.items()}
    # create reserved sub-folders, each with a marker README
    reserved_dir = os.path.join(cat_dir, "reserved")
    ensure(reserved_dir)
    folders = {}
    for fname, desc in RESERVED_FOLDERS.items():
        fdir = os.path.join(reserved_dir, fname)
        ensure(fdir)
        with open(os.path.join(fdir, "README.txt"), "w") as f:
            f.write(f"RESERVED — {fname}\n\n{desc}\n\n"
                    "This folder is intentionally empty. It only reserves a home and "
                    "naming pattern for future art. No system consumes it yet.\n")
        folders[fname] = {"path": f"expansion/reserved/{fname}", "description": desc, "reserved": True}
    return f"expansion/{sheet_name}", entries, folders


def main():
    ensure(OUT)
    manifest = {
        "pack": "River Run Fishing — Phase 4 Buildings, UI & Expansion Foundation Pack",
        "version": PACK_VERSION,
        "note": "Procedurally generated structures, lodge decoration, UI "
                "(icons/buttons/panels matching the game's exact HUD palette), "
                "event effects, and a RESERVED expansion structure (art "
                "placeholders + empty folders only — no systems). Buildings & "
                "decor are transparent objects; UI matches existing colours so "
                "it drops into current panels; effects are play-once animation "
                "strips.",
        "categories": {},
    }

    bsheet, bentries = build_static("buildings", BUILDINGS, columns=4)
    manifest["categories"]["buildings"] = {"sheet": bsheet, "assets": bentries}

    dsheet, dentries = build_static("decor", DECOR, columns=4)
    manifest["categories"]["decor"] = {"sheet": dsheet, "assets": dentries}

    ui = build_ui()
    manifest["categories"]["ui"] = {"sheets": ui["sheets"], "assets": ui["assets"]}

    esheet, eentries = build_animated("effects", EFFECTS, columns=7)
    manifest["categories"]["effects"] = {"sheet": esheet, "assets": eentries}

    xsheet, xentries, xfolders = build_expansion()
    manifest["categories"]["expansion"] = {
        "sheet": xsheet, "assets": xentries, "reserved_folders": xfolders,
        "note": "Reserved art structure only. No systems are implemented for these.",
    }

    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    # summary
    counts = {
        "buildings": len(bentries), "decor": len(dentries),
        "ui": len(ui["assets"]), "effects": len(eentries),
        "expansion(reserved)": len(xentries),
    }
    total = sum(counts.values())
    fcount = sum(a.get("frames", 1) for c in manifest["categories"].values() for a in c["assets"].values())
    print(f"Phase 4 build complete. {total} assets / {fcount} frames.")
    for k, v in counts.items():
        print(f"  {k:22s} {v}")
    print(f"  reserved folders: {list(xfolders.keys())}")


if __name__ == "__main__":
    main()
