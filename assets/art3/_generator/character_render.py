"""
Phase 3 — parametric humanoid character renderer.

A character is a data record (skin, hair, hat, shirt, pants, boots, build).
The renderer draws it at a given (direction, pose, frame). This is the same
data-driven approach as the fish renderer: one renderer, many characters,
fully consistent style — so future NPCs/enemies "fit the system" by
construction.

Canvas: 24x32. Footprint anchors near the bottom (~y=30) so the sprite sits
on the ground correctly. Directions: 'down','up','left','right'.
Poses: idle, walk, run, cast, reel, attack, hurt, death.
"""

from __future__ import annotations
import numpy as np
from PIL import Image
import math

W, H = 24, 32
CX = W // 2  # horizontal centre


def _c():
    return np.zeros((H, W, 4), dtype=np.uint8)


def _p(a, x, y, col, alpha=255):
    x = int(round(x)); y = int(round(y))
    if 0 <= x < W and 0 <= y < H and col is not None:
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


def _shadow(a, cy_off=0):
    cx, cy = CX, 30 + cy_off
    for x in range(cx - 5, cx + 6):
        for y in range(cy - 1, cy + 2):
            if ((x - cx) / 6) ** 2 + ((y - cy) / 2) ** 2 <= 1:
                _p(a, x, y, (8, 12, 14), 70)


def default_char(skin, hair, hat, shirt, pants, boots, hat_style="brim", build="normal"):
    return dict(skin=skin, hair=hair, hat=hat, shirt=shirt, pants=pants,
                boots=boots, hat_style=hat_style, build=build)


def _limb_phase(pose, frame, nframes):
    """Return (leg_swing, arm_swing, body_bob, arm_special) for a pose/frame."""
    t = frame / max(1, nframes)
    cyc = math.sin(t * 2 * math.pi)
    if pose in ("walk",):
        return cyc * 2.0, -cyc * 1.6, abs(cyc) * 0.6, 0
    if pose == "run":
        return cyc * 3.0, -cyc * 2.6, abs(cyc) * 1.0, 0
    if pose == "idle":
        return 0, 0, math.sin(t * 2 * math.pi) * 0.5, 0
    if pose == "cast":
        # wind back then throw forward over the frames
        return 0, 0, 0, t  # arm_special 0..1 progression
    if pose == "reel":
        return 0, math.sin(t * 4 * math.pi) * 1.5, 0, 0
    if pose == "attack":
        return 0, 0, 0, t  # swing progression
    if pose == "hurt":
        return 0, 0, -1.0, 0
    if pose == "death":
        return 0, 0, 0, t  # fall progression
    return 0, 0, 0, 0


def render_character(spec, direction="down", pose="idle", frame=0, nframes=4) -> Image.Image:
    a = _c()
    leg_sw, arm_sw, bob, special = _limb_phase(pose, frame, nframes)

    skin = spec["skin"]; hair = spec["hair"]; hat = spec["hat"]
    shirt = spec["shirt"]; pants = spec["pants"]; boots = spec["boots"]

    # death: rotate the whole figure down (drawn lying) at the last frames
    if pose == "death" and special > 0.5:
        _draw_dead(a, spec)
        return Image.fromarray(a, "RGBA")

    _shadow(a, cy_off=0 if pose != "death" else 1)

    by = int(-bob)  # body vertical offset
    # ---- Legs / boots ----
    lift = int(leg_sw)
    # two legs at x = CX-2 and CX+2
    boot_top = 26 + by
    _rect(a, CX - 3, 22 + by, CX - 1, boot_top - lift, pants)      # left leg
    _rect(a, CX + 1, 22 + by, CX + 3, boot_top + lift, pants)      # right leg
    _rect(a, CX - 3, boot_top - lift, CX - 1, boot_top + 1 - lift, boots)
    _rect(a, CX + 1, boot_top + lift, CX + 3, boot_top + 1 + lift, boots)

    # ---- Torso (shirt/vest) ----
    _rect(a, CX - 4, 15 + by, CX + 3, 22 + by, shirt)
    # shading down the side
    for y in range(15 + by, 23 + by):
        _p(a, CX + 3, y, _dark(shirt))
        _p(a, CX - 4, y, _lite(shirt, 0.12))
    # overall straps hint
    _p(a, CX - 2, 16 + by, _dark(shirt, 0.6)); _p(a, CX + 1, 16 + by, _dark(shirt, 0.6))

    # ---- Arms ----
    _draw_arms(a, spec, direction, pose, arm_sw, special, by)

    # ---- Head ----
    head_cy = 10 + by
    _draw_head(a, spec, direction, head_cy)

    # ---- Hat ----
    _draw_hat(a, spec, direction, head_cy)

    # hurt flash overlay (whiten)
    if pose == "hurt":
        for y in range(H):
            for x in range(W):
                if a[y, x, 3] > 0:
                    r = int(a[y, x, 0]); g = int(a[y, x, 1]); b = int(a[y, x, 2]); al = int(a[y, x, 3])
                    a[y, x] = (min(255, r + 90), min(255, g + 90), min(255, b + 90), al)

    return Image.fromarray(a, "RGBA")


def _draw_head(a, spec, direction, cy):
    skin = spec["skin"]; hair = spec["hair"]
    # head block 6x6 centered
    _rect(a, CX - 3, cy - 3, CX + 2, cy + 2, skin)
    # shading
    for y in range(cy - 3, cy + 3):
        _p(a, CX + 2, y, _dark(skin, 0.85))
    if direction == "down":
        # eyes
        _p(a, CX - 2, cy, (30, 30, 36)); _p(a, CX + 1, cy, (30, 30, 36))
        # nose/mouth hint
        _p(a, CX - 1, cy + 2, _dark(skin, 0.7))
    elif direction == "up":
        # back of head: hair covers
        _rect(a, CX - 3, cy - 3, CX + 2, cy + 1, hair)
    elif direction == "left":
        _p(a, CX - 2, cy, (30, 30, 36))  # one eye
        _p(a, CX - 3, cy + 1, _dark(skin, 0.7))  # nose to the left
    elif direction == "right":
        _p(a, CX + 1, cy, (30, 30, 36))
        _p(a, CX + 2, cy + 1, _dark(skin, 0.7))
    # hair fringe (unless full hat covers it)
    if spec["hat_style"] != "none" or True:
        _p(a, CX - 3, cy - 3, hair); _p(a, CX + 2, cy - 3, hair)


def _draw_hat(a, spec, direction, cy):
    hat = spec["hat"]; style = spec["hat_style"]
    if style == "none":
        # just hair on top
        _rect(a, CX - 3, cy - 4, CX + 2, cy - 3, spec["hair"])
        return
    if style == "brim":
        # wide-brim fisherman hat
        _rect(a, CX - 5, cy - 3, CX + 4, cy - 3, hat)   # brim
        _rect(a, CX - 3, cy - 6, CX + 2, cy - 4, hat)   # crown
        for x in range(CX - 5, CX + 5):
            _p(a, x, cy - 3, _dark(hat, 0.8))
        _p(a, CX - 3, cy - 5, _lite(hat, 0.2))  # crown highlight
    elif style == "cap":
        _rect(a, CX - 3, cy - 5, CX + 2, cy - 4, hat)
        _rect(a, CX - 4, cy - 4, CX + 1, cy - 4, hat)  # short bill (down dir)
        _p(a, CX - 3, cy - 5, _lite(hat, 0.2))
    elif style == "straw":
        _rect(a, CX - 5, cy - 3, CX + 4, cy - 3, hat)
        _rect(a, CX - 3, cy - 5, CX + 2, cy - 4, hat)
        for x in range(CX - 5, CX + 5):
            if x % 2:
                _p(a, x, cy - 3, _dark(hat, 0.75))


def _draw_arms(a, spec, direction, pose, arm_sw, special, by):
    skin = spec["skin"]; shirt = spec["shirt"]
    # base arm positions: shoulders at y=16, hands ~y=21
    sw = int(arm_sw)
    if pose == "cast":
        # one arm raised holding rod; progress special 0..1 = wind->throw
        ang = -1.2 + special * 1.8  # radians from vertical
        hx = CX + 4 + int(math.cos(ang) * 4)
        hy = 17 + int(math.sin(ang) * 4)
        _rect(a, CX + 3, 16 + by, CX + 4, 19 + by, shirt)  # upper arm
        _p(a, hx, hy, skin); _p(a, hx, hy + 1, skin)        # hand
        # rod line
        rod_tip_x = hx + 6; rod_tip_y = hy - 5 + int(special * 8)
        _line(a, hx, hy, rod_tip_x, rod_tip_y, (120, 84, 50))
        # left arm normal
        _rect(a, CX - 5, 16 + by, CX - 4, 20 + by, shirt)
        _p(a, CX - 5, 21 + by, skin)
        return
    if pose == "attack":
        # swing a short weapon arc on the facing side
        side = 1 if direction in ("right", "down") else -1
        ang = -0.6 + special * 1.8
        hx = CX + side * (3 + int(math.cos(ang) * 5))
        hy = 18 + int(math.sin(ang) * 3)
        _rect(a, CX + (2 if side > 0 else -3), 16 + by, CX + (3 if side > 0 else -2), 19 + by, shirt)
        _p(a, hx, hy, skin)
        # weapon (a stick/blade)
        _line(a, hx, hy, hx + side * 5, hy - 4, (180, 186, 196))
        # other arm
        _rect(a, CX - side * 5, 16 + by, CX - side * 4, 20 + by, shirt)
        return
    # default arms swinging with walk/run
    _rect(a, CX - 5, 16 + by - sw, CX - 4, 20 + by - sw, shirt)
    _p(a, CX - 5, 21 + by - sw, skin)
    _rect(a, CX + 4, 16 + by + sw, CX + 5, 20 + by + sw, shirt)
    _p(a, CX + 5, 21 + by + sw, skin)


def _line(a, x0, y0, x1, y1, col):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / n if n else 0
        _p(a, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, col)


def _draw_dead(a, spec):
    """Character lying on the ground (final death frame)."""
    skin = spec["skin"]; shirt = spec["shirt"]; pants = spec["pants"]; hat = spec["hat"]
    base_y = 27
    # shadow
    for x in range(4, 21):
        _p(a, x, base_y + 2, (8, 12, 14), 70)
    # body lying horizontally
    _rect(a, 6, base_y, 14, base_y + 2, shirt)     # torso
    _rect(a, 14, base_y, 19, base_y + 2, pants)    # legs
    _rect(a, 3, base_y - 1, 6, base_y + 1, skin)   # head
    # hat fallen off to the side
    _rect(a, 1, base_y + 2, 4, base_y + 2, hat)
    # X eye
    _p(a, 4, base_y, (30, 30, 36))
