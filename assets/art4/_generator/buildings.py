"""
Phase 4 — building generator.

Wooden cabins/structures in the reference's warm style: log/plank walls,
peaked shingled roofs, framed windows, doors. Buildings render on canvases
sized to their footprint (transparent background, soft ground shadow).

A building is assembled from reusable parts (wall, roof, window, door) so
new structures are easy to compose — supporting the "future regions" goal.
"""

from __future__ import annotations
import numpy as np
from PIL import Image
import math


def _c(w, h):
    return np.zeros((h, w, 4), dtype=np.uint8)


def _p(a, x, y, col, alpha=255):
    h, w = a.shape[:2]
    x = int(round(x)); y = int(round(y))
    if 0 <= x < w and 0 <= y < h and col is not None:
        r = max(0, min(255, int(col[0]))); g = max(0, min(255, int(col[1]))); b = max(0, min(255, int(col[2])))
        a[y, x] = (r, g, b, max(0, min(255, int(alpha))))


def _rect(a, x0, y0, x1, y1, col):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            _p(a, x, y, col)


def _dark(c, f=0.72):
    return tuple(int(v * f) for v in c)


def _lite(c, f=0.3):
    return tuple(min(255, int(v + (255 - v) * f)) for v in c)


def _shadow(a, cx, cy, rx, ry):
    for y in range(int(cy - ry), int(cy + ry + 1)):
        for x in range(int(cx - rx), int(cx + rx + 1)):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                _p(a, x, y, (8, 12, 14), 70)


# Palettes
WALL = [(150, 110, 70), (124, 90, 56), (98, 70, 44)]   # plank light/mid/dark
LOG = [(160, 122, 80), (134, 100, 62)]
ROOF_BLUE = [(86, 110, 138), (60, 82, 110), (44, 62, 86)]
ROOF_BROWN = [(120, 80, 54), (94, 62, 40), (70, 46, 30)]
ROOF_GREEN = [(86, 120, 84), (62, 94, 62), (46, 72, 46)]
WINDOW = [(150, 200, 220), (96, 150, 180)]  # glass
WOODTRIM = [(70, 50, 34), (96, 70, 44)]
STONE = [(120, 124, 130), (92, 96, 104)]


def _plank_wall(a, x0, y0, x1, y1, cols=WALL):
    """Horizontal plank wall with seams + side shading."""
    for y in range(y0, y1 + 1):
        band = (y - y0) // 3
        base = cols[0] if band % 2 == 0 else cols[1]
        for x in range(x0, x1 + 1):
            _p(a, x, y, base)
        if (y - y0) % 3 == 2:
            for x in range(x0, x1 + 1):
                _p(a, x, y, _dark(base, 0.8))  # plank seam
    # corner posts
    for y in range(y0, y1 + 1):
        _p(a, x0, y, cols[2]); _p(a, x1, y, cols[2])


def _roof(a, cx, base_y, half_w, height, cols):
    """Peaked roof: triangle of shingle rows."""
    for j in range(height):
        y = base_y - j
        w = int(half_w * (1 - j / height))
        row_col = cols[0] if j % 2 == 0 else cols[1]
        for x in range(cx - w, cx + w + 1):
            _p(a, x, y, row_col)
        # eave shadow at bottom edge
        if j == 0:
            for x in range(cx - half_w - 1, cx + half_w + 2):
                _p(a, x, y + 1, cols[2])
    # ridge highlight
    _p(a, cx, base_y - height + 1, _lite(cols[0], 0.3))


def _window(a, x0, y0, w=5, h=5):
    _rect(a, x0 - 1, y0 - 1, x0 + w, y0 + h, WOODTRIM[0])  # frame
    _rect(a, x0, y0, x0 + w - 1, y0 + h - 1, WINDOW[0])    # glass
    # cross mullions
    midx = x0 + w // 2
    for y in range(y0, y0 + h):
        _p(a, midx, y, WOODTRIM[1])
    midy = y0 + h // 2
    for x in range(x0, x0 + w):
        _p(a, x, midy, WOODTRIM[1])
    _p(a, x0, y0, _lite(WINDOW[0], 0.4))  # glass glint


def _door(a, x0, y0, w=6, h=9, col=WOODTRIM[1]):
    _rect(a, x0, y0, x0 + w, y0 + h, _dark(col, 0.8))
    _rect(a, x0 + 1, y0 + 1, x0 + w - 1, y0 + h, col)
    # planks
    for x in range(x0 + 1, x0 + w, 2):
        for y in range(y0 + 1, y0 + h + 1):
            _p(a, x, y, _dark(col, 0.85))
    _p(a, x0 + w - 1, y0 + h // 2, (220, 200, 120))  # knob


# ---- Buildings -------------------------------------------------------------
def village_house(roof=ROOF_BROWN):
    a = _c(48, 48)
    _shadow(a, 24, 45, 20, 3)
    _plank_wall(a, 8, 24, 40, 43)
    _door(a, 13, 34, 6, 9)
    _window(a, 27, 28)
    _roof(a, 24, 24, 22, 12, roof)
    # chimney
    _rect(a, 32, 14, 35, 20, STONE[1]); _rect(a, 32, 13, 35, 14, STONE[0])
    return Image.fromarray(a, "RGBA")


def village_house_blue():
    return village_house(ROOF_BLUE)


def village_house_green():
    return village_house(ROOF_GREEN)


def shop():
    a = _c(56, 50)
    _shadow(a, 28, 47, 24, 3)
    _plank_wall(a, 6, 24, 50, 45)
    # big shopfront window
    _window(a, 10, 30, w=12, h=8)
    _door(a, 30, 36, 7, 9)
    _roof(a, 28, 24, 26, 12, ROOF_BLUE)
    # awning over the window (striped)
    for x in range(8, 25):
        col = (200, 80, 70) if (x // 2) % 2 else (230, 220, 210)
        _p(a, x, 29, col); _p(a, x, 30, _dark(col, 0.85))
    # hanging sign
    _rect(a, 38, 27, 47, 32, WOODTRIM[1])
    _p(a, 42, 24, WOODTRIM[0]); _p(a, 42, 25, WOODTRIM[0]); _p(a, 42, 26, WOODTRIM[0])
    _p(a, 41, 29, (236, 198, 96)); _p(a, 43, 29, (236, 198, 96))  # "$" hint
    return Image.fromarray(a, "RGBA")


def fishing_hut():
    a = _c(48, 48)
    _shadow(a, 24, 45, 20, 3)
    # raised on short stilts over the waterline
    for sx in (12, 24, 36):
        _rect(a, sx, 40, sx + 1, 45, WOODTRIM[0])
    _plank_wall(a, 8, 22, 40, 40, cols=[(140, 116, 80), (112, 92, 60), (88, 70, 46)])
    _door(a, 12, 31, 6, 9)
    _window(a, 28, 26)
    _roof(a, 24, 22, 22, 11, ROOF_GREEN)
    # fish sign + hanging net
    for y in range(34, 40):
        for x in range(33, 39):
            if (x + y) % 2:
                _p(a, x, y, (180, 190, 200), 150)  # net mesh
    return Image.fromarray(a, "RGBA")


def dock():
    a = _c(56, 32)
    # wooden pier extending right over water
    _rect(a, 2, 14, 52, 20, LOG[1])
    for x in range(2, 53, 4):
        _rect(a, x, 14, x + 1, 20, LOG[0])  # planks
    # posts going down into water
    for px in (8, 22, 36, 50):
        _rect(a, px, 20, px + 1, 28, WOODTRIM[0])
        _p(a, px, 28, (40, 80, 100), 160)  # ripple where it meets water
    # a small ladder / cleat
    _rect(a, 48, 10, 49, 14, WOODTRIM[1])
    return Image.fromarray(a, "RGBA")


# ---- Lodge components (modular pieces) ------------------------------------
def lodge_wall():
    a = _c(24, 32)
    _plank_wall(a, 2, 6, 21, 30, cols=LOG + [(_dark(LOG[1], 0.7))])
    # log ends texture
    for y in range(6, 31, 4):
        _p(a, 2, y, _dark(LOG[1], 0.6)); _p(a, 21, y, _dark(LOG[1], 0.6))
    return Image.fromarray(a, "RGBA")


def lodge_roof():
    a = _c(32, 20)
    _roof(a, 16, 16, 15, 12, ROOF_BROWN)
    return Image.fromarray(a, "RGBA")


def lodge_door():
    a = _c(16, 28)
    _door(a, 3, 4, 9, 22, col=(120, 86, 54))
    return Image.fromarray(a, "RGBA")


def lodge_window():
    a = _c(16, 16)
    _window(a, 4, 4, w=7, h=7)
    return Image.fromarray(a, "RGBA")


def storage_crate():
    a = _c(16, 16)
    _shadow(a, 8, 14, 6, 2)
    _rect(a, 3, 4, 13, 14, WALL[1])
    _rect(a, 3, 4, 13, 5, WALL[0])  # top edge
    # frame slats
    _rect(a, 3, 4, 4, 14, WALL[2]); _rect(a, 12, 4, 13, 14, WALL[2])
    _p(a, 3, 4, WALL[2]); _p(a, 13, 14, WALL[2])
    for y in (8, 9):
        for x in range(3, 14):
            _p(a, x, y, _dark(WALL[1], 0.8))
    return Image.fromarray(a, "RGBA")


def market_stall():
    a = _c(40, 36)
    _shadow(a, 20, 33, 17, 3)
    # counter
    _rect(a, 6, 24, 34, 30, WALL[1])
    _rect(a, 6, 24, 34, 25, WALL[0])
    # posts
    _rect(a, 7, 10, 8, 30, WOODTRIM[0]); _rect(a, 32, 10, 33, 30, WOODTRIM[0])
    # striped canopy
    for x in range(4, 37):
        col = (90, 150, 160) if (x // 3) % 2 else (230, 220, 210)
        _p(a, x, 10, col); _p(a, x, 11, _dark(col, 0.85))
    # scalloped edge
    for x in range(4, 37, 4):
        _p(a, x, 12, (90, 150, 160)); _p(a, x + 1, 12, (90, 150, 160))
    # goods on counter (crates/baskets)
    _rect(a, 10, 21, 14, 24, (150, 110, 60))
    _rect(a, 22, 20, 27, 24, (170, 140, 90))
    _p(a, 24, 19, (200, 80, 70))  # apple-ish
    return Image.fromarray(a, "RGBA")


BUILDINGS = {
    "village_house_brown": village_house,
    "village_house_blue": village_house_blue,
    "village_house_green": village_house_green,
    "shop": shop,
    "fishing_hut": fishing_hut,
    "dock": dock,
    "lodge_wall": lodge_wall,
    "lodge_roof": lodge_roof,
    "lodge_door": lodge_door,
    "lodge_window": lodge_window,
    "storage_crate": storage_crate,
    "market_stall": market_stall,
}
