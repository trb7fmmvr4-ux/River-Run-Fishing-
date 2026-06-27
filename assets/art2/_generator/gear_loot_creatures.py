"""Phase 2 — fishing gear, loot items, ambient creatures.

Gear: rods (starter + improved tiers), reels, hooks, bobbers, line spools.
Loot: ancient coin, rusty hook, rod fragment, treasure map, mystery box.
Creatures: frogs, birds, butterflies, dragonflies (small animation strips)."""

from __future__ import annotations
import numpy as np
from PIL import Image
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from core import new_rng


def _c(w, h):
    return np.zeros((h, w, 4), dtype=np.uint8)


def _p(a, x, y, col, alpha=255):
    h, w = a.shape[:2]
    x = int(round(x)); y = int(round(y))
    if 0 <= x < w and 0 <= y < h:
        r = max(0, min(255, int(col[0]))); g = max(0, min(255, int(col[1]))); b = max(0, min(255, int(col[2])))
        a[y, x] = (r, g, b, max(0, min(255, int(alpha))))


def _line(a, x0, y0, x1, y1, col):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / n if n else 0
        _p(a, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, col)


def _shadow(a, cx, cy, rx, ry):
    for y in range(int(cy - ry), int(cy + ry + 1)):
        for x in range(int(cx - rx), int(cx + rx + 1)):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                _p(a, x, y, (8, 12, 14), 60)


# Palette bits
WOOD = [(54, 38, 26), (88, 60, 36), (120, 84, 50), (152, 110, 70)]
METAL = [(70, 76, 84), (112, 120, 130), (158, 166, 176), (200, 206, 214)]
GOLD = [(150, 110, 40), (200, 156, 60), (236, 198, 96), (250, 226, 150)]
RED = [(150, 40, 38), (200, 60, 54), (228, 92, 84)]


# ---- Rods (32x48, diagonal) -----------------------------------------------
def _rod(seed, shaft_cols, has_guides, tier):
    a = _c(32, 48)
    rng = new_rng(seed)
    # rod runs from bottom-left handle to top-right tip
    hx, hy = 6, 44
    tx, ty = 28, 6
    # grip
    for i in range(7):
        _p(a, hx, hy - i, WOOD[1] if i % 2 else WOOD[0])
        _p(a, hx + 1, hy - i, WOOD[2])
    # shaft (tapered) — draw several parallel offset lines for thickness near base
    steps = 40
    for s in range(steps):
        t = s / steps
        x = hx + (tx - hx) * t
        y = hy - 7 - (hy - 7 - ty) * t
        col = shaft_cols[min(len(shaft_cols) - 1, int(t * len(shaft_cols)))]
        _p(a, x, y, col)
        if t < 0.5:  # thicker near handle
            _p(a, x, y + 1, shaft_cols[0])
    # line guides
    if has_guides:
        for gt in (0.3, 0.55, 0.8):
            x = hx + (tx - hx) * gt
            y = hy - 7 - (hy - 7 - ty) * gt
            _p(a, x, y - 1, METAL[2])
    # tier flourish: gold tip wrap for higher tiers
    if tier >= 2:
        _p(a, tx, ty, GOLD[2]); _p(a, tx - 1, ty + 1, GOLD[1])
    if tier >= 3:
        for i in range(3):
            _p(a, hx + 1, hy - i, GOLD[2])
    return Image.fromarray(a, "RGBA")


def rod_starter():
    return _rod("rod-starter", [WOOD[0], WOOD[1]], False, 1)


def rod_river():
    return _rod("rod-river", [WOOD[1], WOOD[2]], True, 1)


def rod_angler():
    return _rod("rod-angler", [METAL[0], METAL[1], METAL[2]], True, 2)


def rod_master():
    return _rod("rod-master", [(40, 50, 70), (60, 80, 110), (90, 120, 160)], True, 3)


def rod_mythic():
    a_img = _rod("rod-mythic", [(90, 60, 120), (130, 90, 170), (170, 130, 210)], True, 3)
    a = np.array(a_img)
    # glow specks
    rng = new_rng("rod-mythic-glow")
    for _ in range(10):
        x = rng.integers(6, 30); y = rng.integers(6, 44)
        if a[y, x, 3] > 0:
            _p(a, x, y - 1, (210, 180, 255), 160)
    return Image.fromarray(a, "RGBA")


# ---- Reels (16x16) ---------------------------------------------------------
def _reel(seed, body_col, accent):
    a = _c(16, 16)
    _shadow(a, 8, 14, 6, 2)
    # spool circle
    for y in range(3, 13):
        for x in range(3, 13):
            d = ((x - 8) ** 2 + (y - 8) ** 2) ** 0.5
            if d < 5:
                _p(a, x, y, body_col if d > 2.2 else accent)
            if 4.0 < d < 5.0:
                _p(a, x, y, METAL[0])
    # handle
    _p(a, 13, 8, METAL[2]); _p(a, 14, 9, METAL[1]); _p(a, 14, 10, WOOD[2])
    # center bolt
    _p(a, 8, 8, METAL[3])
    return Image.fromarray(a, "RGBA")


def reel_basic():
    return _reel("reel-basic", METAL[1], METAL[0])


def reel_steel():
    return _reel("reel-steel", METAL[2], METAL[1])


def reel_gold():
    return _reel("reel-gold", GOLD[1], GOLD[0])


# ---- Hooks (16x16) ---------------------------------------------------------
def _hook(seed, col):
    a = _c(16, 16)
    _shadow(a, 8, 15, 4, 1)
    hl = (220, 226, 232)
    # eye (loop) at top
    for (x, y) in [(7, 2), (8, 2), (9, 3), (8, 4), (7, 3)]:
        _p(a, x, y, col)
    # straight shank coming down
    for y in range(4, 9):
        _p(a, 8, y, col)
        _p(a, 8, y, hl if y == 5 else col)  # highlight glint
    # the bend: a clear U-curve sweeping left then back up
    curve = [(8, 9), (8, 10), (7, 11), (6, 12), (5, 12), (4, 11), (4, 10), (4, 9), (5, 8)]
    for (x, y) in curve:
        _p(a, x, y, col)
    # inner shading on the bend for depth
    for (x, y) in [(7, 10), (6, 11), (5, 11)]:
        _p(a, x, y, _shade(col))
    # the point + barb at the tip (pointing up-inward)
    _p(a, 5, 8, col); _p(a, 5, 7, col)       # point rising
    _p(a, 6, 8, col)                          # barb
    return Image.fromarray(a, "RGBA")


def _shade(col, f=0.7):
    return tuple(int(v * f) for v in col)


def hook_basic():
    return _hook("hook-basic", METAL[1])


def hook_steel():
    return _hook("hook-steel", METAL[2])


def hook_barbed():
    a = np.array(_hook("hook-barbed", METAL[2]))
    # extra serrations along the point
    _p(a, 6, 9, METAL[1]); _p(a, 7, 9, METAL[1])
    return Image.fromarray(a, "RGBA")


# ---- Bobbers (16x16) -------------------------------------------------------
def _bobber(seed, top_col, bot_col=(236, 236, 236)):
    a = _c(16, 16)
    _shadow(a, 8, 14, 4, 1)
    for y in range(4, 13):
        for x in range(4, 12):
            d = ((x - 8) ** 2 + (y - 8) ** 2) ** 0.5
            if d < 4:
                _p(a, x, y, top_col if y < 8 else bot_col)
    # divider line
    for x in range(4, 12):
        if ((x - 8) ** 2 + 0) ** 0.5 < 4:
            _p(a, x, 8, (40, 40, 44))
    # top antenna + highlight
    _p(a, 8, 3, (40, 40, 44)); _p(a, 8, 2, (40, 40, 44))
    _p(a, 6, 6, (255, 255, 255), 180)
    return Image.fromarray(a, "RGBA")


def bobber_classic():
    return _bobber("bob-classic", RED[1])


def bobber_blue():
    return _bobber("bob-blue", (60, 110, 170))


def bobber_green():
    return _bobber("bob-green", (80, 150, 90))


# ---- Line spools / line assets (16x16) ------------------------------------
def line_spool():
    a = _c(16, 16)
    _shadow(a, 8, 14, 5, 2)
    # spool sides
    for y in range(4, 12):
        _p(a, 3, y, WOOD[1]); _p(a, 12, y, WOOD[1])
    _p(a, 3, 4, WOOD[2]); _p(a, 12, 4, WOOD[2])
    # wound line
    for y in range(5, 11):
        for x in range(4, 12):
            _p(a, x, y, (220, 224, 228) if (x + y) % 2 else (188, 196, 204))
    return Image.fromarray(a, "RGBA")


def line_coil():
    a = _c(16, 16)
    # loose coil of line
    cx, cy = 8, 9
    for r in (5, 4, 3):
        steps = int(2 * np.pi * r)
        for i in range(steps):
            ang = 2 * np.pi * i / steps
            x = cx + np.cos(ang) * r
            y = cy + np.sin(ang) * r * 0.7
            _p(a, x, y, (210, 216, 222) if i % 2 else (180, 188, 196))
    return Image.fromarray(a, "RGBA")


# ---- Loot items (16x16) ----------------------------------------------------
def ancient_coin():
    a = _c(16, 16)
    _shadow(a, 8, 14, 5, 2)
    for y in range(3, 14):
        for x in range(3, 14):
            d = ((x - 8) ** 2 + (y - 8) ** 2) ** 0.5
            if d < 5.5:
                _p(a, x, y, GOLD[1] if d > 4 else GOLD[2])
    # engraving (a rune-ish mark)
    _p(a, 8, 6, GOLD[0]); _p(a, 8, 7, GOLD[0]); _p(a, 8, 8, GOLD[0])
    _p(a, 6, 8, GOLD[0]); _p(a, 10, 8, GOLD[0])
    _p(a, 6, 5, GOLD[3], 200)  # shine
    return Image.fromarray(a, "RGBA")


def rusty_hook():
    a = np.array(_hook("loot-rusty", (140, 90, 60)))
    rng = new_rng("rust")
    for _ in range(8):
        x = rng.integers(4, 12); y = rng.integers(2, 13)
        if a[y, x, 3] > 0:
            _p(a, x, y, (110, 66, 40))
    return Image.fromarray(a, "RGBA")


def rod_fragment():
    a = _c(16, 16)
    _shadow(a, 8, 13, 5, 1)
    # a broken rod piece, diagonal
    _line(a, 3, 12, 12, 4, WOOD[1])
    _line(a, 3, 13, 12, 5, WOOD[0])
    _p(a, 4, 11, WOOD[2]); _p(a, 11, 5, WOOD[2])
    # jagged break ends
    _p(a, 12, 4, WOOD[3]); _p(a, 13, 4, (120, 84, 50))
    _p(a, 3, 12, WOOD[3])
    return Image.fromarray(a, "RGBA")


def treasure_map():
    a = _c(16, 16)
    _shadow(a, 8, 14, 6, 1)
    # parchment
    for y in range(3, 13):
        for x in range(3, 13):
            _p(a, x, y, (206, 184, 140) if (x + y) % 5 else (190, 168, 124))
    # rolled edges
    for y in range(3, 13):
        _p(a, 3, y, (170, 148, 108)); _p(a, 12, y, (170, 148, 108))
    # dashed route + X
    for x in range(5, 11, 2):
        _p(a, x, 9, (120, 80, 50))
    _p(a, 10, 6, (180, 50, 46)); _p(a, 11, 7, (180, 50, 46))
    _p(a, 11, 6, (180, 50, 46)); _p(a, 10, 7, (180, 50, 46))
    return Image.fromarray(a, "RGBA")


def mystery_box():
    a = _c(16, 16)
    _shadow(a, 8, 14, 6, 2)
    # wooden crate
    for y in range(5, 14):
        for x in range(3, 13):
            _p(a, x, y, WOOD[1] if (x + y) % 4 else WOOD[2])
    # lid
    for x in range(3, 13):
        _p(a, x, 5, WOOD[2]); _p(a, x, 6, WOOD[0])
    # metal bands + question mark glow
    for y in range(5, 14):
        _p(a, 7, y, METAL[1])
    _p(a, 8, 8, (240, 220, 120)); _p(a, 9, 8, (240, 220, 120))
    _p(a, 9, 9, (240, 220, 120)); _p(a, 8, 10, (240, 220, 120))
    _p(a, 8, 12, (240, 220, 120))
    # glow corners
    _p(a, 3, 5, (255, 240, 160), 160); _p(a, 12, 5, (255, 240, 160), 160)
    return Image.fromarray(a, "RGBA")


# ---- Ambient creatures (animation strips) ---------------------------------
def frog():
    """16x16, 2 frames (sit / mid-hop)."""
    frames = []
    for f in range(2):
        a = _c(16, 16)
        _shadow(a, 8, 14, 5, 1)
        body = (86, 140, 72); dark = (60, 104, 52); belly = (180, 200, 140)
        # body
        for y in range(7 - f, 13 - f):
            for x in range(4, 12):
                d = ((x - 8) / 4) ** 2 + ((y - (10 - f)) / 3) ** 2
                if d <= 1:
                    _p(a, x, y, body if y < 11 - f else belly)
        # eyes
        _p(a, 6, 7 - f, dark); _p(a, 10, 7 - f, dark)
        _p(a, 6, 6 - f, body); _p(a, 10, 6 - f, body)
        _p(a, 6, 6 - f, (240, 240, 240)); _p(a, 10, 6 - f, (240, 240, 240))
        _p(a, 6, 6 - f, (20, 20, 20)); _p(a, 10, 6 - f, (20, 20, 20))
        # legs
        if f == 0:
            _p(a, 4, 12, dark); _p(a, 12, 12, dark); _p(a, 3, 13, dark); _p(a, 13, 13, dark)
        else:
            _p(a, 3, 9, dark); _p(a, 13, 9, dark)  # extended mid-hop
        frames.append(Image.fromarray(a, "RGBA"))
    return frames


def bird():
    """16x12, 3 frames (wings up / level / down)."""
    frames = []
    wing_y = [3, 6, 9]
    for f in range(3):
        a = _c(16, 12)
        body = (90, 78, 64); dark = (60, 50, 40); accent = (180, 130, 70)
        # body
        for x in range(6, 11):
            _p(a, x, 6, body); _p(a, x, 7, dark)
        _p(a, 11, 6, accent)  # beak
        _p(a, 10, 5, (20, 20, 20))  # eye
        # tail
        _p(a, 5, 7, dark); _p(a, 4, 7, dark)
        # wings (symmetric, position by frame)
        wy = wing_y[f]
        for i in range(4):
            _p(a, 7 - i, wy + i if f == 0 else (6 + (i if f == 2 else 0)), body)
            _p(a, 9 + i, wy + i if f == 0 else (6 + (i if f == 2 else 0)), body)
        frames.append(Image.fromarray(a, "RGBA"))
    return frames


def butterfly():
    """14x12, 2 frames (wings open / wings angled)."""
    frames = []
    for f in range(2):
        a = _c(14, 12)
        body = (44, 40, 38)
        wing = (224, 150, 64)
        wing_lt = (240, 192, 110)
        spot = (110, 70, 160)
        cx = 7
        # body
        for y in range(4, 9):
            _p(a, cx, y, body)
        _p(a, cx, 3, body); _p(a, cx - 1, 2, body); _p(a, cx + 1, 2, body)  # antennae
        # wing shape per side: upper (big) + lower (small) lobes
        narrow = 0 if f == 0 else 2  # frame 1 = wings angled toward viewer (narrower)
        for sx in (-1, 1):
            upper = [(2, 3), (3, 3), (4, 3), (2, 4), (3, 4), (4, 4), (5, 4), (3, 5), (4, 5)]
            lower = [(2, 7), (3, 7), (2, 8), (3, 8)]
            for (dx, dy) in upper:
                _p(a, cx + sx * (dx - narrow // 2) if narrow else cx + sx * dx, dy,
                   wing_lt if dx >= 4 else wing)
            for (dx, dy) in lower:
                if not narrow:
                    _p(a, cx + sx * dx, dy, wing)
            # wing spot
            _p(a, cx + sx * (3 if not narrow else 2), 4, spot)
        frames.append(Image.fromarray(a, "RGBA"))
    return frames


def dragonfly():
    """16x12, 2 frames (wing positions A/B)."""
    frames = []
    for f in range(2):
        a = _c(16, 12)
        body = (60, 150, 160); tail = (90, 185, 195); head = (40, 110, 120)
        eye = (30, 80, 90)
        cy = 6
        # head + big eyes on the right
        _p(a, 13, cy, head); _p(a, 13, cy - 1, eye); _p(a, 13, cy + 1, eye)
        _p(a, 14, cy, eye)
        # thorax + long segmented tail to the left
        for x in range(3, 13):
            _p(a, x, cy, body if x > 7 else tail)
            if x <= 7 and x % 2:
                _p(a, x, cy, (50, 130, 140))  # tail segments
        # two wing pairs spanning out from the thorax (x~10)
        wcol = (210, 230, 236)
        wx = 10
        if f == 0:
            # wings angled up/down
            for i in range(4):
                _p(a, wx - i, cy - 2 - (i // 2), wcol, 170)
                _p(a, wx - i, cy + 2 + (i // 2), wcol, 170)
                _p(a, wx + 1 - i, cy - 2, wcol, 130)
                _p(a, wx + 1 - i, cy + 2, wcol, 130)
        else:
            # wings more horizontal (mid-beat)
            for i in range(5):
                _p(a, wx - i, cy - 1, wcol, 170)
                _p(a, wx - i, cy + 1, wcol, 170)
        frames.append(Image.fromarray(a, "RGBA"))
    return frames


GEAR = {
    "rod_starter": rod_starter, "rod_river": rod_river, "rod_angler": rod_angler,
    "rod_master": rod_master, "rod_mythic": rod_mythic,
    "reel_basic": reel_basic, "reel_steel": reel_steel, "reel_gold": reel_gold,
    "hook_basic": hook_basic, "hook_steel": hook_steel, "hook_barbed": hook_barbed,
    "bobber_classic": bobber_classic, "bobber_blue": bobber_blue, "bobber_green": bobber_green,
    "line_spool": line_spool, "line_coil": line_coil,
}

LOOT = {
    "ancient_coin": ancient_coin, "rusty_hook": rusty_hook, "rod_fragment": rod_fragment,
    "treasure_map": treasure_map, "mystery_box": mystery_box,
}

CREATURES = {
    "frog": frog, "bird": bird, "butterfly": butterfly, "dragonfly": dragonfly,
}
