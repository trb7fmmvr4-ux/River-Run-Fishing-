"""Phase 4 — lodge decoration: beds, tables, chairs, lanterns, trophy
displays, fish mounts. Furniture for the buildable/customizable lodge."""

from __future__ import annotations
import numpy as np
from PIL import Image


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


WOOD = [(150, 110, 70), (120, 86, 54), (92, 66, 42)]
CLOTH = [(120, 150, 180), (90, 120, 150)]


def bed():
    a = _c(24, 16)
    _shadow(a, 12, 14, 11, 2)
    # frame
    _rect(a, 2, 6, 22, 13, WOOD[2])
    _rect(a, 2, 5, 22, 6, WOOD[1])
    # mattress
    _rect(a, 3, 7, 21, 11, (220, 210, 196))
    # blanket
    _rect(a, 12, 7, 21, 11, CLOTH[0])
    _rect(a, 12, 7, 21, 7, _lite(CLOTH[0], 0.2))
    # pillow
    _rect(a, 4, 7, 9, 10, (240, 236, 228))
    # posts
    _rect(a, 2, 4, 3, 13, WOOD[1]); _rect(a, 21, 4, 22, 13, WOOD[1])
    return Image.fromarray(a, "RGBA")


def table():
    a = _c(20, 16)
    _shadow(a, 10, 14, 9, 2)
    _rect(a, 2, 5, 18, 7, WOOD[0])      # top
    _rect(a, 2, 5, 18, 5, _lite(WOOD[0], 0.2))
    _rect(a, 2, 7, 18, 8, WOOD[2])      # apron
    _rect(a, 3, 8, 4, 14, WOOD[1])      # legs
    _rect(a, 16, 8, 17, 14, WOOD[1])
    return Image.fromarray(a, "RGBA")


def chair():
    a = _c(12, 16)
    _shadow(a, 6, 14, 5, 2)
    _rect(a, 3, 2, 8, 8, WOOD[1])       # back
    _rect(a, 3, 2, 8, 3, _lite(WOOD[1], 0.2))
    _rect(a, 3, 8, 8, 10, WOOD[0])      # seat
    _rect(a, 3, 10, 4, 14, WOOD[2])     # legs
    _rect(a, 7, 10, 8, 14, WOOD[2])
    return Image.fromarray(a, "RGBA")


def lantern():
    a = _c(12, 16)
    _shadow(a, 6, 14, 4, 1)
    # top cap + ring
    _rect(a, 5, 1, 6, 2, (90, 90, 96))
    _rect(a, 3, 2, 8, 3, (70, 70, 76))
    # glass body with flame
    _rect(a, 3, 4, 8, 11, (60, 64, 70))
    _rect(a, 4, 5, 7, 10, (255, 220, 130))   # glow
    _rect(a, 5, 6, 6, 9, (255, 180, 80))     # flame
    _p(a, 5, 7, (255, 240, 200))
    # base
    _rect(a, 3, 11, 8, 12, (70, 70, 76))
    # warm light bloom
    for (dx, dy) in [(2, 7), (9, 7), (5, 3), (5, 13)]:
        _p(a, dx, dy, (255, 220, 140), 90)
    return Image.fromarray(a, "RGBA")


def trophy_display():
    a = _c(16, 16)
    _shadow(a, 8, 14, 6, 2)
    # wooden plaque/shelf
    _rect(a, 2, 10, 14, 13, WOOD[2])
    _rect(a, 2, 10, 14, 10, WOOD[0])
    # gold trophy cup
    gold = (236, 198, 96); gold_d = (180, 140, 50)
    _rect(a, 6, 4, 9, 8, gold)
    _p(a, 5, 5, gold_d); _p(a, 10, 5, gold_d)  # handles
    _rect(a, 7, 8, 8, 9, gold_d)               # stem
    _rect(a, 6, 9, 9, 10, gold)                # base
    _p(a, 7, 4, (255, 240, 180))               # shine
    return Image.fromarray(a, "RGBA")


def _fish_mount(body, accent):
    a = _c(20, 14)
    _shadow(a, 10, 12, 8, 1)
    # wooden mounting plaque
    _rect(a, 2, 2, 17, 11, WOOD[2])
    _rect(a, 2, 2, 17, 2, WOOD[1])
    _rect(a, 3, 3, 16, 10, _dark(WOOD[2], 0.85))
    # mounted fish (side profile, facing right)
    cx, cy = 10, 6
    for xx in range(-6, 6):
        t = (xx + 6) / 12
        import math
        prof = math.sin(math.pi * (0.15 + 0.75 * t)) ** 0.7
        half = 3 * prof
        for yy in range(int(-half), int(half) + 1):
            v = (yy + half) / (2 * half + 0.01)
            col = _dark(body, 0.8) if v < 0.4 else body
            _p(a, cx + xx, cy + yy, col)
    # tail
    for i in range(-2, 3):
        _p(a, cx - 7, cy + i, accent)
    # eye
    _p(a, cx + 4, cy - 1, (240, 240, 240)); _p(a, cx + 4, cy - 1, (20, 20, 24))
    # little nameplate
    _p(a, 8, 10, (220, 200, 120)); _p(a, 9, 10, (220, 200, 120)); _p(a, 10, 10, (220, 200, 120))
    return Image.fromarray(a, "RGBA")


def fish_mount_bass():
    return _fish_mount((96, 140, 84), (70, 104, 64))


def fish_mount_trout():
    return _fish_mount((150, 156, 160), (190, 110, 120))


def fish_mount_legendary():
    return _fish_mount((236, 198, 96), (255, 170, 90))


DECOR = {
    "bed": bed,
    "table": table,
    "chair": chair,
    "lantern": lantern,
    "trophy_display": trophy_display,
    "fish_mount_bass": fish_mount_bass,
    "fish_mount_trout": fish_mount_trout,
    "fish_mount_legendary": fish_mount_legendary,
}
