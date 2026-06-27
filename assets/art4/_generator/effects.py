"""Phase 4 — visual effects: legendary catch, exotic catch, boss spawn,
quest completion. Each returns a list of animation frames (transparent),
designed to play once over a catch/event."""

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
        prev = a[y, x]
        if prev[3] == 0 or alpha >= prev[3]:
            a[y, x] = (r, g, b, max(0, min(255, int(alpha))))


def _ring(a, cx, cy, r, col, alpha, squash=1.0):
    if r <= 0:
        return
    steps = max(10, int(2 * math.pi * r))
    for i in range(steps):
        ang = 2 * math.pi * i / steps
        x = cx + math.cos(ang) * r
        y = cy + math.sin(ang) * r * squash
        _p(a, x, y, col, alpha)


def _star_burst(a, cx, cy, n, length, col, alpha, rot=0.0):
    for k in range(n):
        ang = rot + 2 * math.pi * k / n
        for r in range(length):
            fade = int(alpha * (1 - r / length))
            _p(a, cx + math.cos(ang) * r, cy + math.sin(ang) * r, col, fade)


# Rarity colours (match game)
LEGEND = (0xFF, 0xB1, 0xF4)
LEGEND_HI = (0xFF, 0xE0, 0xF8)
GOLD = (0xF4, 0xC1, 0x70)
EXOTIC = (0xFF, 0x7C, 0xE0)
EXOTIC_HI = (0xE0, 0xC0, 0xFF)
BLUE = (0x7F, 0xD9, 0xFF)
MINT = (0x8C, 0xFF, 0xB0)
WHITE = (0xFF, 0xFF, 0xFF)


def legendary_catch():
    """32x32, 6 frames — golden/pink radiant burst with rotating rays."""
    frames = []
    cx, cy = 16, 16
    for f in range(6):
        a = _c(32, 32)
        t = f / 5
        # expanding ring
        _ring(a, cx, cy, 2 + t * 13, GOLD, int(220 * (1 - t)))
        _ring(a, cx, cy, t * 10, LEGEND, int(200 * (1 - t)))
        # rotating star rays
        _star_burst(a, cx, cy, 8, int(4 + t * 10), LEGEND_HI, int(230 * (1 - t * 0.7)), rot=t * 1.2)
        # central flash early
        if f < 3:
            for r in range(4 - f):
                _ring(a, cx, cy, r, WHITE, 240)
        # sparkle motes
        rng = np.random.default_rng(f)
        for _ in range(6):
            ang = rng.uniform(0, 2 * math.pi); rad = rng.uniform(4, 12) * (0.5 + t)
            _p(a, cx + math.cos(ang) * rad, cy + math.sin(ang) * rad, GOLD, int(220 * (1 - t)))
        frames.append(Image.fromarray(a, "RGBA"))
    return frames


def exotic_catch():
    """40x40, 7 frames — purple/iridescent vortex, grander than legendary."""
    frames = []
    cx, cy = 20, 20
    for f in range(7):
        a = _c(40, 40)
        t = f / 6
        # double expanding rings
        _ring(a, cx, cy, 2 + t * 17, EXOTIC, int(220 * (1 - t)))
        _ring(a, cx, cy, 1 + t * 12, EXOTIC_HI, int(210 * (1 - t)))
        _ring(a, cx, cy, t * 8, BLUE, int(180 * (1 - t)))
        # spiral arms
        for arm in range(5):
            base = arm * 2 * math.pi / 5 + t * 3
            for s in range(int(4 + t * 14)):
                rad = s * 0.9
                ang = base + s * 0.35
                fade = int(230 * (1 - s / (4 + t * 14)) * (1 - t * 0.5))
                _p(a, cx + math.cos(ang) * rad, cy + math.sin(ang) * rad, EXOTIC_HI, fade)
        if f < 3:
            for r in range(5 - f):
                _ring(a, cx, cy, r, WHITE, 245)
        frames.append(Image.fromarray(a, "RGBA"))
    return frames


def boss_spawn():
    """48x48, 7 frames — ominous shockwave + rising dark energy + warning ring."""
    frames = []
    cx, cy = 24, 24
    for f in range(7):
        a = _c(48, 48)
        t = f / 6
        # ground shockwave (flat ellipse) expanding
        _ring(a, cx, cy + 8, 3 + t * 20, (200, 60, 70), int(220 * (1 - t)), squash=0.4)
        _ring(a, cx, cy + 8, 1 + t * 14, (255, 140, 120), int(180 * (1 - t)), squash=0.4)
        # rising energy columns
        rng = np.random.default_rng(100 + f)
        for _ in range(10):
            ex = rng.integers(8, 40)
            ey = cy + 8 - int(rng.uniform(0, 18) * (0.4 + t))
            col = (180, 40, 60) if rng.random() < 0.5 else (120, 30, 50)
            _p(a, ex, ey, col, int(220 * (1 - t * 0.6)))
            _p(a, ex, ey + 1, col, int(160 * (1 - t)))
        # warning ring (red, pulsing) upright
        pulse = int(180 + 60 * math.sin(t * math.pi * 3))
        _ring(a, cx, cy, 14, (220, 50, 60), pulse if f % 2 == 0 else pulse // 2)
        # central dark mass forming
        rad = int(2 + t * 6)
        for r in range(rad):
            _ring(a, cx, cy, r, (30, 10, 20), int(200 * t))
        frames.append(Image.fromarray(a, "RGBA"))
    return frames


def quest_complete():
    """32x32, 6 frames — green check burst with upward sparkles."""
    frames = []
    cx, cy = 16, 16
    for f in range(6):
        a = _c(32, 32)
        t = f / 5
        # expanding mint ring
        _ring(a, cx, cy, 2 + t * 12, MINT, int(220 * (1 - t)))
        # checkmark draws on over first frames, then holds + fades
        draw = min(1.0, t * 1.6)
        # check stroke: down-right then up-right
        p1 = (10, 16); p2 = (14, 20); p3 = (22, 11)
        seg1 = int(4 * min(1.0, draw * 2))
        for i in range(seg1):
            x = p1[0] + (p2[0] - p1[0]) * i / 4
            y = p1[1] + (p2[1] - p1[1]) * i / 4
            _p(a, x, y, WHITE, 240); _p(a, x, y + 1, MINT, 240)
        if draw > 0.5:
            seg2 = int(8 * min(1.0, (draw - 0.5) * 2))
            for i in range(seg2):
                x = p2[0] + (p3[0] - p2[0]) * i / 8
                y = p2[1] + (p3[1] - p2[1]) * i / 8
                _p(a, x, y, WHITE, 240); _p(a, x, y + 1, MINT, 240)
        # rising sparkles
        rng = np.random.default_rng(200 + f)
        for _ in range(5):
            sx = rng.integers(6, 26)
            sy = cy - int(rng.uniform(0, 12) * t) + 4
            _p(a, sx, sy, MINT, int(220 * (1 - t)))
        frames.append(Image.fromarray(a, "RGBA"))
    return frames


EFFECTS = {
    "legendary_catch": legendary_catch,
    "exotic_catch": exotic_catch,
    "boss_spawn": boss_spawn,
    "quest_complete": quest_complete,
}
