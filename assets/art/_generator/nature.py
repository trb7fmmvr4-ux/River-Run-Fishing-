"""Nature objects (transparent background): trees, pine trees, bushes,
flowers, mushrooms, reeds, logs, stumps, small & large rocks.

Trees / large rocks render on a 32x48 canvas (taller than wide, to fit a
canopy above a trunk); small props on 16x16. All have soft drop shadows."""

from __future__ import annotations
import numpy as np
from core import PAL, to_image, new_rng
import numpy as _np


def _canvas(w, h):
    return _np.zeros((h, w, 4), dtype=_np.uint8)


def _put(arr, x, y, color, a=255):
    h, w = arr.shape[:2]
    if 0 <= x < w and 0 <= y < h:
        arr[y, x] = (*color, a)


def _disc(arr, cx, cy, r, color, rng=None, jitter=0.0, a=255):
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            rr = r + (rng.uniform(-jitter, jitter) if (rng is not None and jitter) else 0)
            if d <= rr:
                _put(arr, x, y, color, a)


def _shadow(arr, cx, cy, rx, ry):
    for y in range(int(cy - ry), int(cy + ry + 1)):
        for x in range(int(cx - rx), int(cx + rx + 1)):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                _put(arr, x, y, (8, 12, 10), a=70)


def _shade_canopy(arr, cx, cy, r, dark, mid, lt, hi, rng):
    """Layered canopy: dark base disc, mid, light offset up-left, hi specks."""
    _disc(arr, cx, cy, r, dark, rng, jitter=1.2)
    _disc(arr, cx, cy, r - 1.5, mid, rng, jitter=1.0)
    _disc(arr, cx - r * 0.28, cy - r * 0.28, r * 0.62, lt, rng, jitter=0.8)
    # highlight flecks
    for _ in range(int(r * 2.2)):
        ang = rng.uniform(0, 2 * np.pi)
        rad = rng.uniform(0, r * 0.5)
        x = int(cx - r * 0.25 + np.cos(ang) * rad)
        y = int(cy - r * 0.25 + np.sin(ang) * rad)
        _put(arr, x, y, hi)


def tree():
    """Broadleaf tree, 32x48."""
    arr = _canvas(32, 48)
    rng = new_rng("tree")
    _shadow(arr, 16, 45, 11, 4)
    # trunk
    for y in range(30, 46):
        w = 2 if y < 40 else 3
        for x in range(16 - w, 16 + w):
            c = PAL["wood_md"] if x < 16 else PAL["wood_dk"]
            _put(arr, x, y, c)
    _put(arr, 14, 44, PAL["wood_lt"]); _put(arr, 18, 44, PAL["bark_dk"])
    # canopy (two overlapping puffs)
    _shade_canopy(arr, 16, 18, 13, PAL["grass_sh"], PAL["grass_dk"], PAL["grass_md"], PAL["grass_hi"], rng)
    _shade_canopy(arr, 10, 22, 8, PAL["grass_sh"], PAL["grass_dk"], PAL["grass_lt"], PAL["grass_hi"], rng)
    _shade_canopy(arr, 23, 22, 8, PAL["grass_sh"], PAL["grass_dk"], PAL["grass_lt"], PAL["grass_hi"], rng)
    return to_image(arr)


def pine_tree():
    """Conifer, 32x48 — stacked triangular tiers."""
    arr = _canvas(32, 48)
    rng = new_rng("pine")
    _shadow(arr, 16, 45, 9, 3)
    # trunk
    for y in range(38, 46):
        for x in range(14, 18):
            _put(arr, x, y, PAL["wood_dk"] if x >= 16 else PAL["wood_md"])
    tiers = [(40, 14), (31, 12), (22, 9), (14, 6)]
    for (base_y, half) in tiers:
        for i in range(half * 2):
            yy = base_y - i
            w = half - i // 1
            w = max(0, half - i)
            for x in range(16 - w, 16 + w + 1):
                if x < 16:
                    c = PAL["grass_md"]
                elif x == 16:
                    c = PAL["grass_lt"]
                else:
                    c = PAL["grass_dk"]
                _put(arr, x, yy, c)
            # tip highlight
            _put(arr, 16 - w, yy, PAL["grass_dk"])
    # snowy/light specks on left
    for _ in range(18):
        ty = rng.integers(16, 44); tx = rng.integers(16 - 6, 16)
        _put(arr, tx, ty, PAL["grass_hi"])
    _put(arr, 16, 12, PAL["grass_hi"])
    return to_image(arr)


def bush():
    arr = _canvas(24, 20)
    rng = new_rng("bush")
    _shadow(arr, 12, 18, 9, 3)
    _shade_canopy(arr, 12, 11, 8, PAL["grass_sh"], PAL["grass_dk"], PAL["grass_md"], PAL["grass_hi"], rng)
    _shade_canopy(arr, 7, 13, 5, PAL["grass_sh"], PAL["grass_dk"], PAL["grass_lt"], PAL["grass_hi"], rng)
    _shade_canopy(arr, 17, 13, 5, PAL["grass_sh"], PAL["grass_dk"], PAL["grass_lt"], PAL["grass_hi"], rng)
    # a few berries
    for _ in range(4):
        x = rng.integers(6, 18); y = rng.integers(8, 14)
        _put(arr, x, y, PAL["flower_red"])
    return to_image(arr)


def _flower(seed, petal):
    arr = _canvas(16, 16)
    rng = new_rng(seed)
    _shadow(arr, 8, 14, 4, 2)
    # stem
    for y in range(8, 14):
        _put(arr, 8, y, PAL["stem"])
    _put(arr, 7, 11, PAL["stem"]); _put(arr, 9, 10, PAL["stem"])
    # leaf
    _put(arr, 6, 11, PAL["grass_md"]); _put(arr, 10, 12, PAL["grass_md"])
    # blossom: center + 4 petals
    cx, cy = 8, 6
    _put(arr, cx, cy, PAL["flower_yel"])
    for dx, dy in ((0, -2), (0, 2), (-2, 0), (2, 0), (-1, -1), (1, -1), (-1, 1), (1, 1)):
        _put(arr, cx + dx, cy + dy, petal)
    _put(arr, cx, cy, PAL["flower_yel"])
    return to_image(arr)


def flower_red():
    return _flower("fl-red", PAL["flower_red"])


def flower_pink():
    return _flower("fl-pink", PAL["flower_pnk"])


def flower_white():
    return _flower("fl-white", PAL["flower_wht"])


def flower_purple():
    return _flower("fl-purple", PAL["flower_pur"])


def mushroom():
    arr = _canvas(16, 16)
    rng = new_rng("mush")
    _shadow(arr, 8, 14, 4, 2)
    # stem
    for y in range(8, 14):
        for x in range(7, 9):
            _put(arr, x, y, PAL["mush_stem"])
    # cap
    for y in range(4, 9):
        w = 5 - abs(6 - y)
        w = min(5, y - 1)
        for x in range(8 - w, 8 + w + 1):
            _put(arr, x, y, PAL["mush_red"] if x >= 8 else PAL["mush_red"])
    # dots
    for (dx, dy) in ((-2, 5), (1, 4), (3, 6), (-3, 6)):
        _put(arr, 8 + dx, dy, PAL["mush_dot"])
    return to_image(arr)


def mushroom_brown():
    arr = _canvas(16, 16)
    rng = new_rng("mush-brn")
    _shadow(arr, 8, 14, 4, 2)
    for y in range(9, 14):
        for x in range(7, 9):
            _put(arr, x, y, PAL["mush_stem"])
    for y in range(5, 10):
        w = min(5, y - 2)
        for x in range(8 - w, 8 + w + 1):
            _put(arr, x, y, PAL["mush_brn"] if x >= 8 else PAL["dirt_md"])
    return to_image(arr)


def reeds():
    arr = _canvas(20, 28)
    rng = new_rng("reeds")
    _shadow(arr, 10, 26, 7, 2)
    stalks = [(5, 26, 18), (8, 27, 24), (11, 26, 20), (14, 27, 22), (9, 26, 16)]
    for (x0, y0, h) in stalks:
        sway = rng.integers(-1, 2)
        for i in range(h):
            yy = y0 - i
            xx = x0 + (sway if i > h * 0.6 else 0)
            if i < h - 4:
                _put(arr, xx, yy, PAL["reed_md"] if i % 2 else PAL["reed_dk"])
            else:
                _put(arr, xx, yy, PAL["reed_lt"])
        # seed head
        _put(arr, x0 + sway, y0 - h, PAL["reed_tip"])
        _put(arr, x0 + sway, y0 - h + 1, PAL["reed_tip"])
    return to_image(arr)


def log():
    arr = _canvas(28, 16)
    rng = new_rng("log")
    _shadow(arr, 14, 14, 12, 2)
    for y in range(5, 13):
        for x in range(3, 25):
            shade = PAL["wood_md"] if 6 < y < 11 else PAL["wood_dk"]
            _put(arr, x, y, shade)
    # end rings
    for y in range(5, 13):
        for x in range(3, 7):
            d = ((x - 5) ** 2 + (y - 9) ** 2) ** 0.5
            if d < 3.5:
                _put(arr, x, y, PAL["wood_lt"] if d < 1.5 else PAL["wood_dk"])
    # bark texture lines
    for _ in range(10):
        x = rng.integers(8, 24); y = rng.integers(6, 11)
        _put(arr, x, y, PAL["bark_dk"])
    return to_image(arr)


def stump():
    arr = _canvas(20, 18)
    rng = new_rng("stump")
    _shadow(arr, 10, 16, 9, 3)
    # body
    for y in range(7, 16):
        for x in range(5, 15):
            _put(arr, x, y, PAL["wood_md"] if x < 12 else PAL["wood_dk"])
    # top ellipse (cut surface)
    for y in range(4, 9):
        for x in range(4, 16):
            d = ((x - 10) / 6) ** 2 + ((y - 6) / 2.4) ** 2
            if d <= 1:
                rings = ((x - 10) ** 2 + ((y - 6) * 2) ** 2) ** 0.5
                _put(arr, x, y, PAL["wood_lt"] if int(rings) % 2 == 0 else PAL["wood_md"])
    return to_image(arr)


def small_rock():
    arr = _canvas(16, 12)
    rng = new_rng("rock-s")
    _shadow(arr, 8, 10, 6, 2)
    _disc(arr, 8, 7, 4.5, PAL["stone_dk"], rng, jitter=0.8)
    _disc(arr, 7, 6, 3.2, PAL["stone_md"], rng, jitter=0.6)
    _disc(arr, 6, 5, 1.6, PAL["stone_hi"], rng, jitter=0.4)
    return to_image(arr)


def large_rock():
    arr = _canvas(28, 22)
    rng = new_rng("rock-l")
    _shadow(arr, 14, 19, 12, 3)
    _disc(arr, 14, 12, 9, PAL["stone_sh"], rng, jitter=1.2)
    _disc(arr, 13, 11, 7.5, PAL["stone_dk"], rng, jitter=1.0)
    _disc(arr, 11, 9, 5, PAL["stone_md"], rng, jitter=0.8)
    _disc(arr, 10, 8, 2.4, PAL["stone_lt"], rng, jitter=0.5)
    # a crack
    x, y = 16, 6
    for _ in range(8):
        _put(arr, x, y, PAL["stone_sh"])
        x += rng.integers(-1, 2); y += 1
    return to_image(arr)


NATURE = {
    "tree": tree,
    "pine_tree": pine_tree,
    "bush": bush,
    "flower_red": flower_red,
    "flower_pink": flower_pink,
    "flower_white": flower_white,
    "flower_purple": flower_purple,
    "mushroom_red": mushroom,
    "mushroom_brown": mushroom_brown,
    "reeds": reeds,
    "log": log,
    "stump": stump,
    "small_rock": small_rock,
    "large_rock": large_rock,
}
