"""Phase 4 — world expansion reserved structure.

This does NOT create future biomes/bosses/regions/multiplayer systems. It
only prepares the ART STRUCTURE: a set of clearly-labelled placeholder
markers and reserved category folders, so future content has an obvious,
consistent home and naming pattern to slot into.

Each placeholder is a neutral "reserved" tile with a small label glyph, so
if one ever appears in-engine by accident it's obviously a placeholder, not
finished art.
"""

from __future__ import annotations
import numpy as np
from PIL import Image


def _c(w, h):
    return np.zeros((h, w, 4), dtype=np.uint8)


def _p(a, x, y, col, alpha=255):
    h, w = a.shape[:2]
    x = int(round(x)); y = int(round(y))
    if 0 <= x < w and 0 <= y < h and col is not None:
        a[y, x] = (*[max(0, min(255, int(v))) for v in col], max(0, min(255, int(alpha))))


def _placeholder(label_glyph, tint):
    """A 32x32 reserved-slot marker: dashed border, diagonal hatch, glyph."""
    a = _c(32, 32)
    base = tint
    # faint fill
    for y in range(32):
        for x in range(32):
            if (x + y) % 6 < 3:
                _p(a, x, y, base, 60)
    # dashed border
    for x in range(0, 32, 3):
        _p(a, x, 0, base, 200); _p(a, x, 31, base, 200)
    for y in range(0, 32, 3):
        _p(a, 0, y, base, 200); _p(a, 31, y, base, 200)
    # corner ticks
    for (cx, cy) in [(0, 0), (31, 0), (0, 31), (31, 31)]:
        _p(a, cx, cy, base, 255)
    # centre glyph (a simple drawn symbol)
    cxm, cym = 16, 16
    glyph_px = {
        "biome": [(13, 18), (16, 12), (19, 18), (14, 18), (18, 18), (16, 15)],   # mountain
        "boss": [(16, 11), (13, 14), (19, 14), (14, 18), (18, 18), (16, 15)],     # crown-ish
        "region": [(12, 16), (20, 16), (16, 12), (16, 20), (16, 16)],             # compass +
        "multiplayer": [(13, 14), (13, 18), (19, 14), (19, 18), (16, 16)],        # two figures
    }.get(label_glyph, [(16, 16)])
    for (x, y) in glyph_px:
        _p(a, x, y, base, 255)
        _p(a, x + 1, y, base, 180)
    return Image.fromarray(a, "RGBA")


# One representative placeholder per reserved category. The build script also
# creates the empty reserved folders these belong to.
EXPANSION = {
    "reserved_biome": lambda: _placeholder("biome", (120, 180, 140)),
    "reserved_boss": lambda: _placeholder("boss", (210, 150, 90)),
    "reserved_region": lambda: _placeholder("region", (120, 160, 210)),
    "reserved_multiplayer": lambda: _placeholder("multiplayer", (200, 150, 200)),
}

# Reserved folder names (created empty, with a README marker) for future art.
RESERVED_FOLDERS = {
    "future_biomes": "Reserved for future biome art (terrain/water/props for new "
                     "environments: snow, desert, volcanic, etc.). Mirror the "
                     "Phase 1 category layout when filling in.",
    "future_bosses": "Reserved for future boss art (one folder per boss, "
                     "state-per-row sheets like Phase 3's Fish King).",
    "future_regions": "Reserved for future fishing-region art (region-specific "
                      "tilesets, landmarks, decorations).",
    "future_multiplayer": "Reserved for multiplayer-only art (player cosmetic "
                          "variants, name tags, emotes, shared-space props).",
}
