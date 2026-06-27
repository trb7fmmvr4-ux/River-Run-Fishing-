"""
Phase 3 master build — Character & Combat Art Pack.

Output under assets/art3/:
  player/    8 poses x 4 directions, packed per pose (frames across, dirs down)
  npcs/      idle+walk x 4 directions per NPC
  enemies/   idle/move/attack/death per enemy (frames across)
  boss/      idle/attack/charge/special/defeat (frames across)
  manifest.json
"""

from __future__ import annotations
import os, json
from PIL import Image
import sys
sys.path.insert(0, os.path.dirname(__file__))

from character_render import render_character, default_char
from npc_defs import NPCS
from enemy_boss_render import ENEMIES, BOSS

OUT = os.path.join(os.path.dirname(__file__), "..", "river-run-fishing", "assets", "art3")
PACK_VERSION = "1.0.0"
PAD = 1

DIRECTIONS = ["down", "up", "left", "right"]

# Frame counts per player pose (kept small + readable; easy to extend).
PLAYER_POSE_FRAMES = {
    "idle": 4, "walk": 6, "run": 6, "cast": 4,
    "reel": 4, "attack": 4, "hurt": 2, "death": 4,
}
NPC_POSE_FRAMES = {"idle": 4, "walk": 6}

PLAYER = default_char(
    skin=(224, 180, 140), hair=(110, 74, 44), hat=(150, 116, 70),
    shirt=(90, 120, 90), pants=(80, 70, 90), boots=(70, 52, 40),
    hat_style="brim")


def ensure(d): os.makedirs(d, exist_ok=True)


def grid_sheet(rows_of_frames, columns):
    """rows_of_frames: list of (rowname, [images]). Lays each row on its own
    line, padded; returns (sheet, {rowname: [rects]}) with uniform cell size."""
    all_imgs = [im for _, ims in rows_of_frames for im in ims]
    if not all_imgs:
        return None, {}
    cw = max(im.width for im in all_imgs) + PAD * 2
    ch = max(im.height for im in all_imgs) + PAD * 2
    rows = len(rows_of_frames)
    sheet = Image.new("RGBA", (cw * columns, ch * rows), (0, 0, 0, 0))
    rects = {}
    for r, (rowname, ims) in enumerate(rows_of_frames):
        rrects = []
        for c, im in enumerate(ims):
            x = c * cw + PAD + (cw - 2 * PAD - im.width) // 2
            y = r * ch + PAD + (ch - 2 * PAD - im.height) // 2
            sheet.paste(im, (x, y))
            rrects.append({"x": x, "y": y, "w": im.width, "h": im.height})
        rects[rowname] = rrects
    return sheet, rects


def save_individuals(folder, named):
    ensure(folder)
    for name, im in named:
        im.save(os.path.join(folder, name + ".png"))


def build_player():
    cat = os.path.join(OUT, "player"); ensure(cat)
    entries = {}
    sheets = {}
    inds = []
    for pose, nf in PLAYER_POSE_FRAMES.items():
        rows = []
        for d in DIRECTIONS:
            ims = [render_character(PLAYER, direction=d, pose=pose, frame=f, nframes=nf) for f in range(nf)]
            rows.append((d, ims))
            for f, im in enumerate(ims):
                inds.append((f"player_{pose}_{d}_{f}", im))
        cols = max(len(ims) for _, ims in rows)
        sheet, rects = grid_sheet(rows, cols)
        sheet_name = f"player_{pose}_sheet.png"
        sheet.save(os.path.join(cat, sheet_name))
        sheets[pose] = f"player/{sheet_name}"
        entries[pose] = {
            "sheet": f"player/{sheet_name}",
            "animation": True,
            "directions": {d: {"frames": len(r), "frame_rects": r} for d, r in rects.items()},
            "frame_size": [24, 32],
        }
    save_individuals(cat, inds)
    return sheets, entries


def build_npcs():
    cat = os.path.join(OUT, "npcs"); ensure(cat)
    entries = {}
    inds = []
    for npc_id, spec in NPCS.items():
        npc_entry = {}
        for pose, nf in NPC_POSE_FRAMES.items():
            rows = []
            for d in DIRECTIONS:
                ims = [render_character(spec, direction=d, pose=pose, frame=f, nframes=nf) for f in range(nf)]
                rows.append((d, ims))
                for f, im in enumerate(ims):
                    inds.append((f"{npc_id}_{pose}_{d}_{f}", im))
            cols = max(len(ims) for _, ims in rows)
            sheet, rects = grid_sheet(rows, cols)
            sheet_name = f"{npc_id}_{pose}_sheet.png"
            sheet.save(os.path.join(cat, sheet_name))
            npc_entry[pose] = {
                "sheet": f"npcs/{sheet_name}",
                "animation": True,
                "directions": {d: {"frames": len(r), "frame_rects": r} for d, r in rects.items()},
                "frame_size": [24, 32],
            }
        entries[npc_id] = npc_entry
    save_individuals(cat, inds)
    return entries


def build_enemies():
    cat = os.path.join(OUT, "enemies"); ensure(cat)
    entries = {}
    inds = []
    for enemy_id, fn in ENEMIES.items():
        states = fn()
        rows = [(s, frames) for s, frames in states.items()]
        cols = max(len(f) for _, f in rows)
        sheet, rects = grid_sheet(rows, cols)
        sheet_name = f"{enemy_id}_sheet.png"
        sheet.save(os.path.join(cat, sheet_name))
        entries[enemy_id] = {
            "sheet": f"enemies/{sheet_name}",
            "animation": True,
            "states": {s: {"frames": len(r), "frame_rects": r} for s, r in rects.items()},
        }
        for s, frames in states.items():
            for f, im in enumerate(frames):
                inds.append((f"{enemy_id}_{s}_{f}", im))
    save_individuals(cat, inds)
    return entries


def build_boss():
    cat = os.path.join(OUT, "boss"); ensure(cat)
    entries = {}
    inds = []
    for boss_id, fn in BOSS.items():
        states = fn()
        rows = [(s, frames) for s, frames in states.items()]
        cols = max(len(f) for _, f in rows)
        sheet, rects = grid_sheet(rows, cols)
        sheet_name = f"{boss_id}_sheet.png"
        sheet.save(os.path.join(cat, sheet_name))
        entries[boss_id] = {
            "sheet": f"boss/{sheet_name}",
            "animation": True,
            "states": {s: {"frames": len(r), "frame_rects": r} for s, r in rects.items()},
        }
        for s, frames in states.items():
            for f, im in enumerate(frames):
                inds.append((f"{boss_id}_{s}_{f}", im))
    save_individuals(cat, inds)
    return entries


def main():
    ensure(OUT)
    manifest = {
        "pack": "River Run Fishing — Phase 3 Character & Combat Art Pack",
        "version": PACK_VERSION,
        "note": "Procedurally generated character foundation. Player has 8 "
                "poses x 4 directions; NPCs/enemies/boss share the same "
                "parametric renderer so future characters fit by construction. "
                "Sprites are organized as per-state animation sheets: frames "
                "run left-to-right; for directional sheets each direction is "
                "its own row. Frame rects are in the manifest.",
        "directions": DIRECTIONS,
        "categories": {},
    }

    psheets, pentries = build_player()
    manifest["categories"]["player"] = {"sheets_by_pose": psheets, "poses": pentries}

    nentries = build_npcs()
    manifest["categories"]["npcs"] = {"characters": nentries}

    eentries = build_enemies()
    manifest["categories"]["enemies"] = {"creatures": eentries}

    bentries = build_boss()
    manifest["categories"]["boss"] = {"bosses": bentries}

    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    # summary
    def count_frames(d):
        n = 0
        def walk(o):
            nonlocal n
            if isinstance(o, dict):
                if "frame_rects" in o:
                    n += len(o["frame_rects"])
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(d)
        return n

    print("Phase 3 build complete.")
    print(f"  player poses: {len(pentries)} (x4 directions)")
    print(f"  npcs: {len(nentries)}")
    print(f"  enemies: {len(eentries)}")
    print(f"  boss: {len(bentries)}")
    print(f"  total frames: {count_frames(manifest['categories'])}")


if __name__ == "__main__":
    main()
