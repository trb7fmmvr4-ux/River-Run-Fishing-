"""
Phase 2 — parametric fish generator.

A fish is described by a small data record (body shape, fin set, palette,
pattern, size class, rarity flourish). The renderer turns that into a
side-profile pixel-art sprite. This is how we get 63 fish that are clearly
*distinct* but share one cohesive style: same renderer, different data.

Adding a new species later = one more record in fish_defs.py. Nothing about
the renderer changes.
"""

from __future__ import annotations
import numpy as np
from PIL import Image
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from core import new_rng  # reuse Phase 1 seeded RNG


# A fish sprite canvas. Most fish fit 40x20; big ones get 48x24 via size class.
def _canvas(w, h):
    return np.zeros((h, w, 4), dtype=np.uint8)


def _put(arr, x, y, color, a=255):
    h, w = arr.shape[:2]
    x = int(round(x)); y = int(round(y))
    if 0 <= x < w and 0 <= y < h:
        r = 0 if color[0] < 0 else (255 if color[0] > 255 else int(color[0]))
        g = 0 if color[1] < 0 else (255 if color[1] > 255 else int(color[1]))
        b = 0 if color[2] < 0 else (255 if color[2] > 255 else int(color[2]))
        aa = 0 if a < 0 else (255 if a > 255 else int(a))
        arr[y, x] = (r, g, b, aa)


def _lerp(c1, c2, t):
    return tuple(int(round(c1[i] * (1 - t) + c2[i] * t)) for i in range(3))


def _darken(c, f=0.72):
    return tuple(int(round(v * f)) for v in c)


def _lighten(c, f=0.35):
    return tuple(min(255, int(round(v + (255 - v) * f))) for v in c)


# ---------------------------------------------------------------------------
# Body profile: returns, for each column x, the (top, bottom) y of the body.
# Different "shapes" give different silhouettes (the distinct-silhouette req).
# ---------------------------------------------------------------------------
def _body_profile(shape, length, height, cy):
    top = np.zeros(length)
    bot = np.zeros(length)
    for x in range(length):
        t = x / (length - 1)  # 0 (tail) .. 1 (head) — we draw head on right
        # `prof` is the normalized body half-height at this column (0..1),
        # peaking near the middle-front and tapering to the tail/snout.
        if shape == "trout":
            prof = np.sin(np.pi * (0.10 + 0.84 * t)) ** 0.9
            scale = 0.78
        elif shape == "bass":
            prof = np.sin(np.pi * (0.14 + 0.78 * t)) ** 0.75
            scale = 0.95
        elif shape == "eel":
            prof = np.sin(np.pi * (0.04 + 0.92 * t)) ** 1.3
            scale = 0.42
        elif shape == "pike":
            prof = np.sin(np.pi * (0.08 + 0.88 * t)) ** 1.05 * (0.65 + 0.35 * t)
            scale = 0.6
        elif shape == "koi":
            prof = np.sin(np.pi * (0.16 + 0.72 * t)) ** 0.65
            scale = 1.0
        elif shape == "round":
            prof = np.sin(np.pi * (0.18 + 0.68 * t)) ** 0.55
            scale = 1.15
        elif shape == "catfish":
            prof = np.sin(np.pi * (0.12 + 0.80 * t)) ** 0.85
            scale = 0.8
        elif shape == "leviathan":
            prof = np.sin(np.pi * (0.06 + 0.90 * t)) ** 1.0 * (0.7 + 0.3 * np.sin(t * np.pi))
            scale = 0.62
        else:
            prof = np.sin(np.pi * (0.12 + 0.80 * t)) ** 0.85
            scale = 0.8
        half = (height * 0.5) * scale * prof
        # catfish sits a touch lower (flatter belly)
        belly = cy + (height * 0.04 if shape == "catfish" else 0)
        top[x] = belly - half
        bot[x] = belly + half
    return top, bot


def _fill_body(arr, shape, palette, length, height, cy, x0, pattern, rng):
    top, bot = _body_profile(shape, length, height, cy)
    base = palette["base"]
    belly = palette["belly"]
    back = palette["back"]
    for xi in range(length):
        x = x0 + xi
        ytop = top[xi]; ybot = bot[xi]
        if ybot - ytop < 1:
            continue
        for y in range(int(np.floor(ytop)), int(np.ceil(ybot)) + 1):
            # vertical gradient: back (dark, top) -> base -> belly (light, bottom)
            span = (ybot - ytop)
            v = (y - ytop) / span if span > 0 else 0.5
            if v < 0.4:
                col = _lerp(back, base, v / 0.4)
            else:
                col = _lerp(base, belly, (v - 0.4) / 0.6)
            _put(arr, x, y, col)

    # outline (darker) along top & bottom edges
    for xi in range(length):
        x = x0 + xi
        _put(arr, x, top[xi], _darken(back, 0.6))
        _put(arr, x, bot[xi], _darken(back, 0.6))

    # patterns
    _apply_pattern(arr, pattern, palette, length, height, cy, x0, top, bot, rng)


def _apply_pattern(arr, pattern, palette, length, height, cy, x0, top, bot, rng):
    accent = palette.get("accent", _darken(palette["back"], 0.7))
    if pattern == "plain":
        return
    if pattern == "stripes_v":
        for xi in range(2, length - 4, 4):
            x = x0 + xi
            for y in range(int(top[xi]) + 1, int(bot[xi])):
                _put(arr, x, y, accent)
    elif pattern == "stripe_h":
        midband = []
        for xi in range(length):
            yc = (top[xi] + bot[xi]) / 2
            midband.append(yc)
            x = x0 + xi
            _put(arr, x, yc, accent)
            _put(arr, x, yc - 1, _darken(accent, 0.85))
    elif pattern == "spots":
        n = max(4, length // 5)
        for _ in range(n):
            xi = rng.integers(3, length - 3)
            y = rng.integers(int(top[xi]) + 1, max(int(top[xi]) + 2, int(bot[xi])))
            _put(arr, x0 + xi, y, accent)
            if rng.random() < 0.5:
                _put(arr, x0 + xi + 1, y, _darken(accent, 0.8))
    elif pattern == "mottled":
        n = length
        for _ in range(n):
            xi = rng.integers(2, length - 2)
            y = rng.integers(int(top[xi]) + 1, max(int(top[xi]) + 2, int(bot[xi])))
            _put(arr, x0 + xi, y, accent if rng.random() < 0.5 else _lighten(palette["base"], 0.2))
    elif pattern == "bands":
        for xi in range(0, length, 6):
            x = x0 + xi
            for y in range(int(top[xi]), int(bot[xi]) + 1):
                _put(arr, x, y, accent)
    elif pattern == "gradient_glow":
        # exotic: bright dorsal shimmer
        for xi in range(length):
            x = x0 + xi
            yt = int(top[xi]) + 1
            _put(arr, x, yt, _lighten(accent, 0.5))


def _fins(arr, shape, palette, length, height, cy, x0, rarity, rng):
    fin = palette.get("fin", _darken(palette["base"], 0.8))
    fin_lt = _lighten(fin, 0.25)
    top, bot = _body_profile(shape, length, height, cy)
    head_x = x0 + length - 1
    tail_x = x0

    # ---- Tail fin (caudal) on the left ----
    tail_h = int(height * (0.9 if shape in ("trout", "pike", "leviathan") else 0.8))
    for i in range(-tail_h // 2, tail_h // 2 + 1):
        spread = int(abs(i) * 0.6) + 1
        for s in range(spread):
            _put(arr, tail_x - 1 - s, cy + i, fin if s < spread - 1 else fin_lt)
    # forked notch
    if shape in ("trout", "bass", "pike"):
        _put(arr, tail_x - 1, cy, _darken(fin, 0.6))

    # ---- Dorsal fin (top) ----
    dmid = x0 + int(length * 0.55)
    dlen = max(4, int(length * 0.26))
    for xi in range(dlen):
        x = dmid - dlen // 2 + xi
        idx = x - x0
        if 0 <= idx < length:
            peak = int(height * (0.30 if rarity in ("legendary", "exotic") else 0.22))
            h = int(peak * np.sin(np.pi * xi / dlen))
            for k in range(h):
                _put(arr, x, top[idx] - k, fin if k < h - 1 else fin_lt)

    # ornate trailing dorsal ray for rare+ (single accent ray, not a spiky mass)
    if rarity in ("rare", "legendary", "exotic"):
        rx = dmid + dlen // 2
        idx = rx - x0
        if 0 <= idx < length:
            peak = int(height * 0.34)
            for k in range(peak):
                _put(arr, rx, top[idx] - k, fin_lt if k % 2 else fin)

    # ---- Pectoral fin (side, near head) ----
    px = x0 + int(length * 0.72)
    idx = px - x0
    if 0 <= idx < length:
        ymid = (top[idx] + bot[idx]) / 2
        for k in range(int(height * 0.3)):
            _put(arr, px - k // 2, ymid + k, fin if k < height * 0.3 - 1 else fin_lt)

    # ---- Anal fin (bottom) ----
    ax = x0 + int(length * 0.42)
    idx = ax - x0
    if 0 <= idx < length:
        for k in range(int(height * 0.22)):
            _put(arr, ax, bot[idx] + k, fin)


def _head_details(arr, shape, palette, length, height, cy, x0, rng):
    top, bot = _body_profile(shape, length, height, cy)
    head_idx = length - 2
    hx = x0 + head_idx
    ymid = (top[head_idx] + bot[head_idx]) / 2
    # eye
    eye_x = x0 + length - 4
    eye_y = int(top[length - 4] + (bot[length - 4] - top[length - 4]) * 0.35)
    _put(arr, eye_x, eye_y, (245, 245, 245))
    _put(arr, eye_x, eye_y, (20, 20, 24))  # pupil overdraw center
    _put(arr, eye_x, eye_y - 0, (250, 250, 250))
    _put(arr, eye_x, eye_y, (16, 16, 20))
    # gill line
    gx = x0 + int(length * 0.78)
    idx = gx - x0
    for y in range(int(top[idx]) + 1, int(bot[idx])):
        _put(arr, gx, y, _darken(palette["base"], 0.78))
    # mouth hint
    _put(arr, x0 + length - 1, int(ymid), _darken(palette["base"], 0.6))


def _shadow(arr, length, height, cy, x0):
    # soft elliptical shadow under the fish
    sx = x0 + length // 2
    sy = cy + int(height * 0.7) + 1
    rx = length * 0.42
    ry = 2.0
    for y in range(int(sy - ry), int(sy + ry) + 1):
        for x in range(int(sx - rx), int(sx + rx) + 1):
            if ((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2 <= 1:
                _put(arr, x, y, (8, 14, 18), a=55)


def render_fish(spec) -> Image.Image:
    """spec: dict with keys shape, palette, pattern, size, rarity, id."""
    size = spec.get("size", "m")
    if size == "s":
        W, H = 40, 22
        length, height = 30, 12
    elif size == "l":
        W, H = 54, 28
        length, height = 44, 16
    elif size == "xl":
        W, H = 62, 32
        length, height = 52, 19
    else:  # m
        W, H = 46, 24
        length, height = 36, 14

    arr = _canvas(W, H)
    cy = H // 2
    x0 = (W - length) // 2
    rng = new_rng("fish-" + spec["id"])

    _shadow(arr, length, height, cy, x0)
    _fins(arr, spec["shape"], spec["palette"], length, height, cy, x0, spec["rarity"], rng)
    _fill_body(arr, spec["shape"], spec["palette"], length, height, cy, x0, spec["pattern"], rng)
    _head_details(arr, spec["shape"], spec["palette"], length, height, cy, x0, rng)

    # rarity glow outline for legendary/exotic
    if spec["rarity"] in ("legendary", "exotic"):
        glow = spec["palette"].get("glow", _lighten(spec["palette"]["base"], 0.6))
        top, bot = _body_profile(spec["shape"], length, height, cy)
        for xi in range(0, length, 1):
            if xi % 2 == 0:
                _put(arr, x0 + xi, top[xi] - 1, glow, a=150)
                _put(arr, x0 + xi, bot[xi] + 1, glow, a=150)

    return Image.fromarray(arr, "RGBA")
