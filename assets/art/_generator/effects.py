"""Visual effects (transparent): water ripples, shore foam, leaf particles,
ambient nature sparkles. Each returns a list of animation frames."""

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


def _ring(arr, cx, cy, r, color, a):
    if r <= 0:
        return
    steps = max(8, int(2 * np.pi * r))
    for i in range(steps):
        ang = 2 * np.pi * i / steps
        x = int(round(cx + np.cos(ang) * r))
        y = int(round(cy + np.sin(ang) * r * 0.6))  # squashed = top-down
        _put(arr, x, y, color, a)


def water_ripple():
    """Expanding ring, 16x16, 5 frames — for a cast/bobber splash."""
    frames = []
    for f in range(5):
        arr = _canvas(16, 16)
        r = 1 + f * 2.6
        a = max(40, 220 - f * 42)
        _ring(arr, 8, 8, r, PAL["foam"], a)
        if f > 0:
            _ring(arr, 8, 8, r - 2, PAL["river_hi"], a // 2)
        frames.append(to_image(arr))
    return frames


def shore_foam():
    """A drifting foam line, 32x8, 4 frames — overlays the shoreline edge."""
    frames = []
    for f in range(4):
        arr = _canvas(32, 8)
        rng = new_rng(f"foam-{f}")
        phase = f * 0.6
        for x in range(32):
            y = 3 + int(1.6 * np.sin(x / 4.0 + phase))
            _put(arr, x, y, PAL["foam"], a=210)
            if rng.random() < 0.4:
                _put(arr, x, y - 1, PAL["foam_sh"], a=150)
            if rng.random() < 0.25:
                _put(arr, x, y + 1, PAL["foam_sh"], a=120)
        frames.append(to_image(arr))
    return frames


def leaf_particle():
    """A single tumbling leaf, 8x8, 6 frames — emit a few for ambient drift."""
    frames = []
    shapes = [
        [(3, 2), (4, 2), (2, 3), (3, 3), (4, 3), (3, 4)],
        [(4, 2), (3, 3), (4, 3), (5, 3), (4, 4)],
        [(3, 3), (4, 3), (4, 2), (4, 4)],            # edge-on
        [(3, 2), (4, 3), (5, 3), (3, 3), (4, 4)],
        [(2, 3), (3, 3), (4, 3), (3, 2), (3, 4)],
        [(4, 3), (3, 3), (4, 2), (4, 4)],            # edge-on
    ]
    greens = [PAL["grass_md"], PAL["grass_lt"], PAL["flower_red"], PAL["dirt_hi"]]
    for f in range(6):
        arr = _canvas(8, 8)
        col = greens[f % len(greens)]
        for (x, y) in shapes[f]:
            _put(arr, x, y, col)
        frames.append(to_image(arr))
    return frames


def ambient_sparkle():
    """A soft twinkle, 8x8, 4 frames — ambient magic/pollen motes."""
    frames = []
    sizes = [0, 1, 2, 1]
    alphas = [120, 200, 255, 160]
    for f in range(4):
        arr = _canvas(8, 8)
        s = sizes[f]; a = alphas[f]
        _put(arr, 4, 4, PAL["foam"], a)
        if s >= 1:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                _put(arr, 4 + dx, 4 + dy, PAL["flower_yel"], a // 2)
        if s >= 2:
            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                _put(arr, 4 + dx, 4 + dy, PAL["flower_yel"], a // 4)
        frames.append(to_image(arr))
    return frames


EFFECTS = {
    "water_ripple": water_ripple,
    "shore_foam": shore_foam,
    "leaf_particle": leaf_particle,
    "ambient_sparkle": ambient_sparkle,
}
