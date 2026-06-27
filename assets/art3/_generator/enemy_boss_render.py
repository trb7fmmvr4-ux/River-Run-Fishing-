"""
Phase 3 — enemy + boss renderers.

Enemies (slimes, bats, swamp creature): compact creatures, each with
idle/move/attack/death frames. Boss (Fish King): a large multi-state sprite
(idle/attack/charge/special/defeat).

All transparent, soft shadows, sharing the project palette sensibility.
"""

from __future__ import annotations
import numpy as np
from PIL import Image
import math


def _canvas(w, h):
    return np.zeros((h, w, 4), dtype=np.uint8)


def _p(a, x, y, col, alpha=255):
    h, w = a.shape[:2]
    x = int(round(x)); y = int(round(y))
    if 0 <= x < w and 0 <= y < h and col is not None:
        r = max(0, min(255, int(col[0]))); g = max(0, min(255, int(col[1]))); b = max(0, min(255, int(col[2])))
        a[y, x] = (r, g, b, max(0, min(255, int(alpha))))


def _dark(c, f=0.72):
    return tuple(int(v * f) for v in c)


def _lite(c, f=0.3):
    return tuple(min(255, int(v + (255 - v) * f)) for v in c)


def _shadow(a, cx, cy, rx, ry, alpha=70):
    for y in range(int(cy - ry), int(cy + ry + 1)):
        for x in range(int(cx - rx), int(cx + rx + 1)):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                _p(a, x, y, (8, 12, 14), alpha)


# ===========================================================================
# SLIMES  (20x16, 4 states x frames)
# ===========================================================================
def _slime_body(a, cx, cy, w, h, body, hilite, dark, squash=0.0):
    """Draw a rounded slime blob. squash 0..1 flattens it (for hop/land)."""
    rw = w * (1 + squash * 0.3)
    rh = h * (1 - squash * 0.4)
    for y in range(int(cy - rh), int(cy + 2)):
        for x in range(int(cx - rw), int(cx + rw + 1)):
            dx = (x - cx) / rw
            dy = (y - cy) / rh
            if dx * dx + dy * dy <= 1 and y <= cy + 1:
                # gradient: lighter top
                vy = (y - (cy - rh)) / (rh + 1)
                col = _lite(body, 0.25) if vy < 0.35 else (body if vy < 0.8 else _dark(body, 0.85))
                _p(a, x, y, col)
    # flat bottom
    for x in range(int(cx - rw), int(cx + rw + 1)):
        if abs(x - cx) < rw:
            _p(a, x, cy + 1, _dark(body, 0.8))
    # shine
    _p(a, cx - int(rw * 0.4), cy - int(rh * 0.5), hilite)
    _p(a, cx - int(rw * 0.4) + 1, cy - int(rh * 0.5), hilite)


def _slime_face(a, cx, cy, state, angry=False):
    eye = (30, 30, 36)
    if state == "death":
        # X eyes
        _p(a, cx - 3, cy - 2, eye); _p(a, cx - 2, cy - 1, eye)
        _p(a, cx - 2, cy - 3, eye); _p(a, cx - 3, cy - 1, eye)
        _p(a, cx + 3, cy - 2, eye); _p(a, cx + 2, cy - 1, eye)
        _p(a, cx + 2, cy - 3, eye); _p(a, cx + 3, cy - 1, eye)
        return
    _p(a, cx - 3, cy - 2, eye); _p(a, cx - 3, cy - 3, eye)
    _p(a, cx + 2, cy - 2, eye); _p(a, cx + 2, cy - 3, eye)
    if angry:
        # angled brows
        _p(a, cx - 4, cy - 4, eye); _p(a, cx + 3, cy - 4, eye)
        # open mouth
        _p(a, cx - 1, cy - 1, eye); _p(a, cx, cy - 1, eye); _p(a, cx, cy, eye); _p(a, cx - 1, cy, eye)
    else:
        # small smile
        _p(a, cx - 1, cy, eye); _p(a, cx, cy, eye)


def _make_slime(body, hilite):
    dark = _dark(body, 0.6)

    def frames_for(state):
        out = []
        if state == "idle":
            squashes = [0.0, 0.15, 0.0, -0.05]
        elif state == "move":
            squashes = [0.4, 0.0, 0.2, 0.0]  # hop
        elif state == "attack":
            squashes = [-0.2, -0.3, 0.3]     # rear up then slam
        else:  # death
            squashes = [0.0, 0.4, 0.7, 0.9]  # flatten out
        for i, sq in enumerate(squashes):
            a = _canvas(20, 16)
            cx, cy = 10, 12
            _shadow(a, cx, cy + 2, 7, 2)
            alpha_fade = 255
            if state == "death":
                alpha_fade = max(40, 255 - i * 60)
            _slime_body(a, cx, cy, 6, 7, body, hilite, dark, squash=max(0, sq))
            _slime_face(a, cx, cy, state, angry=(state == "attack"))
            if alpha_fade < 255:
                a[:, :, 3] = (a[:, :, 3].astype(int) * alpha_fade // 255).astype(np.uint8)
            out.append(Image.fromarray(a, "RGBA"))
        return out

    return {s: frames_for(s) for s in ["idle", "move", "attack", "death"]}


def green_slime():
    return _make_slime((96, 176, 88), (190, 230, 170))


def blue_slime():
    return _make_slime((84, 140, 200), (180, 215, 240))


# ===========================================================================
# BATS  (16x14, wing-flap animation)
# ===========================================================================
def _make_bat(body, eye_col=(220, 80, 70)):
    dark = _dark(body, 0.6)

    def frames_for(state):
        out = []
        if state == "idle":
            wings = [2, 4]            # gentle hover
        elif state == "move":
            wings = [1, 3, 5, 3]      # full flap
        elif state == "attack":
            wings = [0, 6]            # dive (wings tucked / spread)
        else:  # death
            wings = [4, 2, 0]         # falling, wings collapse
        for i, wy in enumerate(wings):
            a = _canvas(16, 14)
            cx, cy = 8, 7
            if state != "death":
                _shadow(a, cx, 12, 5, 1, alpha=40)
            # body
            _p(a, cx, cy, body); _p(a, cx, cy + 1, body); _p(a, cx, cy - 1, _lite(body, 0.2))
            _p(a, cx - 1, cy, dark); _p(a, cx + 1, cy, dark)
            # ears
            _p(a, cx - 1, cy - 2, body); _p(a, cx + 1, cy - 2, body)
            # eyes
            _p(a, cx - 1, cy, eye_col); _p(a, cx + 1, cy, eye_col)
            # wings (symmetric), span by frame
            for sx in (-1, 1):
                span = 5
                for k in range(1, span + 1):
                    yy = cy - (wy - 3) * k // span
                    _p(a, cx + sx * (1 + k), yy, body if k < span else dark)
                    if k > 2:
                        _p(a, cx + sx * (1 + k), yy + 1, dark)
            if state == "death":
                a[:, :, 3] = (a[:, :, 3].astype(int) * max(50, 255 - i * 70) // 255).astype(np.uint8)
            out.append(Image.fromarray(a, "RGBA"))
        return out

    return {s: frames_for(s) for s in ["idle", "move", "attack", "death"]}


def bat():
    return _make_bat((90, 70, 96))


def cave_bat():
    return _make_bat((70, 78, 110), eye_col=(120, 200, 230))


# ===========================================================================
# SWAMP CREATURE  (24x22, lumbering)
# ===========================================================================
def swamp_creature():
    body = (84, 116, 72); dark = _dark(body, 0.6); belly = (130, 150, 96)
    eye = (220, 200, 90)

    def frames_for(state):
        out = []
        if state == "idle":
            bobs = [0, 1, 0, -1]
        elif state == "move":
            bobs = [0, 2, 0, 2]
        elif state == "attack":
            bobs = [-2, -3, 2]  # rear and lunge
        else:  # death
            bobs = [0, 2, 4, 6]
        for i, bob in enumerate(bobs):
            a = _canvas(24, 22)
            cx, cy = 12, 13 + bob
            _shadow(a, cx, 19, 9, 2)
            # hulking body
            for y in range(cy - 6, cy + 4):
                for x in range(cx - 7, cx + 8):
                    dx = (x - cx) / 7; dy = (y - cy) / 6
                    if dx * dx + dy * dy <= 1:
                        vy = (y - (cy - 6)) / 10
                        col = _lite(body, 0.2) if vy < 0.3 else (body if vy < 0.75 else belly)
                        _p(a, x, y, col)
            # back ridges
            for rx in range(cx - 4, cx + 5, 3):
                _p(a, rx, cy - 6, dark); _p(a, rx, cy - 7, _dark(body, 0.5))
            # eyes (glowing)
            ahead = (state == "attack")
            _p(a, cx - 3, cy - 3, eye); _p(a, cx + 3, cy - 3, eye)
            if ahead:
                _p(a, cx - 3, cy - 4, (255, 230, 120)); _p(a, cx + 3, cy - 4, (255, 230, 120))
                # open maw
                for x in range(cx - 2, cx + 3):
                    _p(a, x, cy + 1, (40, 20, 20))
            # arms/claws
            _p(a, cx - 8, cy + 1, dark); _p(a, cx - 8, cy + 2, body)
            _p(a, cx + 8, cy + 1, dark); _p(a, cx + 8, cy + 2, body)
            if state == "death":
                a[:, :, 3] = (a[:, :, 3].astype(int) * max(50, 255 - i * 55) // 255).astype(np.uint8)
            out.append(Image.fromarray(a, "RGBA"))
        return out

    return {s: frames_for(s) for s in ["idle", "move", "attack", "death"]}


# ===========================================================================
# BOSS — FISH KING  (48x40, 5 states)
# ===========================================================================
def fish_king():
    # regal fish: deep teal body, gold crown, fins
    body = (60, 130, 150); back = (40, 96, 120); belly = (170, 210, 220)
    fin = (90, 170, 190); gold = (236, 198, 96); gold_dk = (180, 140, 50)
    crown = gold; eye = (240, 240, 240); pupil = (20, 20, 28)

    def draw_base(a, cx, cy, mouth_open=False, glow=False, tilt=0):
        # big fish body (ellipse), head to the right
        L, Hh = 30, 16
        for yy in range(-Hh // 2, Hh // 2 + 1):
            for xx in range(-L // 2, L // 2 + 1):
                t = (xx + L / 2) / L
                prof = math.sin(math.pi * (0.12 + 0.8 * t)) ** 0.7
                half = (Hh / 2) * prof
                if abs(yy) <= half:
                    x = cx + xx; y = cy + yy + int(tilt * xx / 10)
                    v = (yy + half) / (2 * half + 0.001)
                    col = back if v < 0.35 else (body if v < 0.75 else belly)
                    _p(a, x, y, col)
        # tail (left)
        for i in range(-8, 9):
            spread = abs(i) // 2 + 2
            for s in range(spread):
                _p(a, cx - L // 2 - 1 - s, cy + i, fin if s < spread - 1 else _lite(fin, 0.3))
        # dorsal fin (spiky, regal)
        for k in range(8):
            x = cx - 4 + k * 2
            h = 6 - abs(k - 4)
            for j in range(h):
                _p(a, x, cy - 8 - j, fin if j < h - 1 else _lite(fin, 0.4))
        # pectoral fin
        for k in range(4):
            _p(a, cx + 6, cy + 3 + k, fin)
        # eye
        ex, ey = cx + 9, cy - 2
        _p(a, ex, ey, eye); _p(a, ex + 1, ey, eye); _p(a, ex, ey + 1, eye)
        _p(a, ex, ey, pupil)
        # gill
        for y in range(cy - 4, cy + 4):
            _p(a, cx + 5, y, _dark(body, 0.8))
        # mouth
        if mouth_open:
            for x in range(cx + 12, cx + 16):
                _p(a, x, cy + 1, (30, 16, 16))
            _p(a, cx + 15, cy, (30, 16, 16)); _p(a, cx + 15, cy + 2, (30, 16, 16))
        else:
            _p(a, cx + 14, cy + 1, _dark(body, 0.6))
        # CROWN (gold, on top of head)
        for cxk in range(-3, 4):
            _p(a, cx + 8 + cxk, cy - 9, gold_dk)
        for spike_x, hh in [(-2, 2), (0, 3), (2, 2)]:
            for j in range(hh):
                _p(a, cx + 8 + spike_x, cy - 9 - j, gold)
        _p(a, cx + 8, cy - 12, (255, 240, 180))  # crown jewel shine
        # glow outline for special
        if glow:
            for gx in range(-L // 2, L // 2 + 1, 2):
                t = (gx + L / 2) / L
                prof = math.sin(math.pi * (0.12 + 0.8 * t)) ** 0.7
                half = (Hh / 2) * prof
                _p(a, cx + gx, cy - half - 1, (200, 240, 255), 160)
                _p(a, cx + gx, cy + half + 1, (200, 240, 255), 160)

    def frames_for(state):
        out = []
        if state == "idle":
            offs = [(0, 0), (0, -1), (0, 0), (0, 1)]
            for (ox, oy) in offs:
                a = _canvas(48, 40)
                _shadow(a, 24, 34, 16, 3)
                draw_base(a, 24 + ox, 20 + oy)
                out.append(Image.fromarray(a, "RGBA"))
        elif state == "attack":
            for i, mo in enumerate([False, True, True]):
                a = _canvas(48, 40)
                _shadow(a, 24, 34, 16, 3)
                draw_base(a, 24 + (i * 2), 20, mouth_open=mo)
                out.append(Image.fromarray(a, "RGBA"))
        elif state == "charge":
            # tilt back then lunge forward (telegraph)
            for i, (ox, tl) in enumerate([(-3, -8), (-4, -10), (4, 4)]):
                a = _canvas(48, 40)
                _shadow(a, 24, 34, 16, 3)
                draw_base(a, 24 + ox, 20, mouth_open=(i == 2), tilt=tl)
                out.append(Image.fromarray(a, "RGBA"))
        elif state == "special":
            # glowing, mouth open, with energy motes
            for i in range(3):
                a = _canvas(48, 40)
                _shadow(a, 24, 34, 16, 3)
                draw_base(a, 24, 20, mouth_open=True, glow=True)
                # swirling motes
                rng = np.random.default_rng(100 + i)
                for _ in range(10):
                    ang = rng.uniform(0, 2 * math.pi); rad = rng.uniform(8, 18)
                    x = 24 + math.cos(ang) * rad; y = 20 + math.sin(ang) * rad * 0.7
                    _p(a, x, y, (180, 230, 255), 200)
                out.append(Image.fromarray(a, "RGBA"))
        else:  # defeat
            for i in range(4):
                a = _canvas(48, 40)
                _shadow(a, 24, 34, 16, 3)
                # roll over: tilt increases, fade
                draw_base(a, 24, 20 + i, tilt=i * 6)
                a[:, :, 3] = (a[:, :, 3].astype(int) * max(60, 255 - i * 55) // 255).astype(np.uint8)
                out.append(Image.fromarray(a, "RGBA"))
        return out

    return {s: frames_for(s) for s in ["idle", "attack", "charge", "special", "defeat"]}


ENEMIES = {
    "green_slime": green_slime,
    "blue_slime": blue_slime,
    "bat": bat,
    "cave_bat": cave_bat,
    "swamp_creature": swamp_creature,
}

BOSS = {
    "fish_king": fish_king,
}
