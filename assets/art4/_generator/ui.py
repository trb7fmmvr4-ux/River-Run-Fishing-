"""Phase 4 — UI: icons, button states, panel backgrounds.

Colours match the game's existing HUD exactly (gold #f4c170, dark #0b0f14,
mint #8cffb0, rarity colours, etc.) so new UI sits seamlessly with the
current panels/HUD. Icons are 16x16; buttons 32x16; panels are 9-slice
sources."""

from __future__ import annotations
import numpy as np
from PIL import Image

# --- exact game palette (from src/ui + GameConfig) ---
GOLD = (0xF4, 0xC1, 0x70)
GOLD_DK = (0x8A, 0x61, 0x1F)
DARK = (0x0B, 0x0F, 0x14)
MINT = (0x8C, 0xFF, 0xB0)
WHITE = (0xFF, 0xFF, 0xFF)
RED = (0xFF, 0x5D, 0x5D)
RARE = (0xFF, 0xD2, 0x7F)
LEGEND = (0xFF, 0xB1, 0xF4)
EXOTIC = (0xFF, 0x7C, 0xE0)
BLUE = (0x7F, 0xD9, 0xFF)
SLATE = (0x9F, 0xB3, 0xC8)


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


def _disc(a, cx, cy, r, col):
    for y in range(int(cy - r), int(cy + r + 1)):
        for x in range(int(cx - r), int(cx + r + 1)):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                _p(a, x, y, col)


def _outline(a, col=DARK):
    """Add a 1px dark outline around opaque pixels (icon readability)."""
    h, w = a.shape[:2]
    mask = a[:, :, 3] > 0
    for y in range(h):
        for x in range(w):
            if not mask[y, x]:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx]:
                        _p(a, x, y, col); break


# ---- Icons (16x16) ---------------------------------------------------------
def icon_inventory():
    a = _c(16, 16)
    # backpack
    _rect(a, 4, 4, 11, 13, (132, 96, 58))
    _rect(a, 4, 4, 11, 5, (160, 122, 80))
    _rect(a, 5, 2, 10, 4, (110, 80, 48))     # top flap/handle
    _rect(a, 6, 8, 9, 11, (90, 66, 42))      # front pocket
    _p(a, 7, 9, GOLD); _p(a, 8, 9, GOLD)     # buckle
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_cooler():
    a = _c(16, 16)
    _rect(a, 3, 6, 12, 13, (96, 150, 180))   # body (cool blue)
    _rect(a, 3, 4, 12, 6, (150, 200, 220))   # lid
    _rect(a, 3, 4, 12, 4, _lite((150, 200, 220), 0.3))
    _p(a, 7, 5, (220, 230, 236)); _p(a, 8, 5, (220, 230, 236))  # latch
    _rect(a, 4, 9, 5, 11, WHITE)             # frost
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_gold():
    a = _c(16, 16)
    _disc(a, 8, 8, 6, GOLD_DK)
    _disc(a, 8, 8, 5, GOLD)
    _p(a, 8, 5, (255, 240, 180))             # shine
    # engraved coin mark
    _rect(a, 7, 6, 8, 11, GOLD_DK)
    _rect(a, 6, 8, 10, 9, GOLD_DK)
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_journal():
    a = _c(16, 16)
    _rect(a, 3, 3, 12, 13, (120, 84, 150))   # cover
    _rect(a, 3, 3, 12, 4, _lite((120, 84, 150), 0.2))
    _rect(a, 5, 3, 6, 13, (90, 60, 116))     # spine
    _rect(a, 7, 5, 11, 6, (230, 226, 218))   # pages lines
    _rect(a, 7, 8, 11, 9, (230, 226, 218))
    _rect(a, 7, 11, 10, 12, (230, 226, 218))
    _p(a, 11, 7, GOLD)                       # bookmark
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_shop():
    a = _c(16, 16)
    # market awning + counter
    for x in range(3, 13):
        col = RED if (x // 2) % 2 else WHITE
        _p(a, x, 4, col); _p(a, x, 5, _dark(col, 0.85))
    _rect(a, 3, 6, 12, 7, (120, 86, 54))     # counter top
    _rect(a, 4, 7, 11, 12, (150, 110, 70))   # stall body
    _p(a, 7, 9, GOLD); _p(a, 8, 9, GOLD)     # coin on counter
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_fish():
    a = _c(16, 16)
    import math
    cx, cy = 8, 8
    body = (96, 150, 180)
    for xx in range(-5, 5):
        t = (xx + 5) / 10
        prof = math.sin(math.pi * (0.15 + 0.75 * t)) ** 0.7
        half = 3 * prof
        for yy in range(int(-half), int(half) + 1):
            _p(a, cx + xx, cy + yy, body if yy < 0 else _dark(body, 0.8))
    for i in range(-2, 3):
        _p(a, cx - 6, cy + i, _lite(body, 0.2))   # tail
    _p(a, cx + 3, cy - 1, WHITE); _p(a, cx + 3, cy - 1, DARK)  # eye
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_hook():
    a = _c(16, 16)
    col = (180, 186, 196)
    for y in range(3, 9):
        _p(a, 9, y, col)
    _p(a, 9, 2, col); _p(a, 8, 2, col); _p(a, 8, 3, col)  # eye
    for (x, y) in [(9, 9), (9, 10), (8, 11), (7, 12), (6, 12), (5, 11), (5, 10), (6, 9)]:
        _p(a, x, y, col)
    _p(a, 6, 9, col); _p(a, 6, 8, col)       # barb point
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_star():
    a = _c(16, 16)
    pts = [(8, 2), (9, 6), (13, 6), (10, 9), (11, 13), (8, 10), (5, 13), (6, 9), (3, 6), (7, 6)]
    # fill star by scanning
    import math
    cx, cy = 8, 8
    for y in range(2, 14):
        for x in range(2, 14):
            ang = math.atan2(y - cy, x - cx)
            rr = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            spikes = 5
            k = (math.cos(spikes * ang - math.pi / 2) * 0.5 + 0.5)
            edge = 2.6 + k * 3.4
            if rr <= edge:
                _p(a, x, y, GOLD if rr < edge - 1 else GOLD_DK)
    _p(a, 7, 5, (255, 240, 180))
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_heart():
    a = _c(16, 16)
    for (cx, cy) in [(6, 6), (10, 6)]:
        _disc(a, cx, cy, 2.4, RED)
    for y in range(6, 13):
        wpan = 6 - (y - 6)
        for x in range(8 - wpan, 8 + wpan + 1):
            _p(a, x, y, RED)
    _p(a, 5, 5, _lite(RED, 0.4))             # shine
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_settings():
    a = _c(16, 16)
    import math
    cx, cy = 8, 8
    for y in range(2, 14):
        for x in range(2, 14):
            ang = math.atan2(y - cy, x - cx)
            rr = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            teeth = (math.cos(8 * ang) * 0.5 + 0.5)
            edge = 4.0 + teeth * 1.8
            if rr <= edge:
                _p(a, x, y, SLATE if rr < edge - 1 else _dark(SLATE, 0.7))
    _disc(a, cx, cy, 2, DARK)
    _disc(a, cx, cy, 1, SLATE)
    _outline(a)
    return Image.fromarray(a, "RGBA")


def icon_info():
    a = _c(16, 16)
    _disc(a, 8, 8, 6, (60, 120, 200))
    _disc(a, 8, 8, 5, BLUE)
    _p(a, 8, 4, WHITE)                       # dot of 'i'
    _rect(a, 8, 6, 8, 11, WHITE)             # stem
    _outline(a)
    return Image.fromarray(a, "RGBA")


# ---- Button states (32x16) -------------------------------------------------
def _button(fill, edge, text_band):
    a = _c(32, 16)
    _rect(a, 1, 1, 30, 14, fill)
    # top highlight + bottom shadow (chunky bevel)
    for x in range(1, 31):
        _p(a, x, 1, _lite(fill, 0.25))
        _p(a, x, 14, _dark(fill, 0.75))
    for y in range(1, 15):
        _p(a, 1, y, _lite(fill, 0.15)); _p(a, 30, y, _dark(fill, 0.8))
    # border
    for x in range(1, 31):
        _p(a, x, 0, edge); _p(a, x, 15, edge)
    for y in range(0, 16):
        _p(a, 0, y, edge); _p(a, 31, y, edge)
    # faux label bar
    _rect(a, 10, 7, 21, 8, text_band)
    return Image.fromarray(a, "RGBA")


def button_normal():
    return _button(GOLD, GOLD_DK, _dark(GOLD, 0.55))


def button_hover():
    return _button(_lite(GOLD, 0.18), GOLD_DK, _dark(GOLD, 0.5))


def button_pressed():
    a = _button(_dark(GOLD, 0.8), GOLD_DK, _dark(GOLD, 0.5))
    return a


def button_disabled():
    return _button(SLATE, _dark(SLATE, 0.6), _dark(SLATE, 0.7))


def button_confirm():
    return _button(MINT, _dark(MINT, 0.6), _dark(MINT, 0.5))


def button_danger():
    return _button(RED, _dark(RED, 0.6), _dark(RED, 0.5))


# ---- Panel backgrounds (9-slice sources, 24x24) ---------------------------
def _panel(border_col, fill_alpha=225):
    a = _c(24, 24)
    _rect(a, 0, 0, 23, 23, DARK)
    a[:, :, 3] = fill_alpha
    # rounded-ish corners (clear them)
    for (cx, cy) in [(0, 0), (23, 0), (0, 23), (23, 23)]:
        a[cy, cx] = (0, 0, 0, 0)
    # border
    for x in range(1, 23):
        _p(a, x, 0, border_col); _p(a, x, 23, border_col)
    for y in range(1, 23):
        _p(a, 0, y, border_col); _p(a, 23, y, border_col)
    # inner highlight
    for x in range(2, 22):
        _p(a, x, 1, _dark(border_col, 0.6), 120)
    return Image.fromarray(a, "RGBA")


def panel_default():
    return _panel(GOLD)


def panel_shop():
    return _panel(MINT)


def panel_journal():
    return _panel(LEGEND)


def panel_info():
    return _panel(BLUE)


ICONS = {
    "icon_inventory": icon_inventory, "icon_cooler": icon_cooler, "icon_gold": icon_gold,
    "icon_journal": icon_journal, "icon_shop": icon_shop, "icon_fish": icon_fish,
    "icon_hook": icon_hook, "icon_star": icon_star, "icon_heart": icon_heart,
    "icon_settings": icon_settings, "icon_info": icon_info,
}

BUTTONS = {
    "button_normal": button_normal, "button_hover": button_hover,
    "button_pressed": button_pressed, "button_disabled": button_disabled,
    "button_confirm": button_confirm, "button_danger": button_danger,
}

PANELS = {
    "panel_default": panel_default, "panel_shop": panel_shop,
    "panel_journal": panel_journal, "panel_info": panel_info,
}
