"""Terrain tiles: grass, tall grass, dirt, dark dirt, sand, forest floor,
stone ground, path. All 32x32, seamlessly tiling."""

from __future__ import annotations
import numpy as np
from core import TILE, PAL, canvas, put, to_image, value_noise, bayer_at, new_rng


def _ramp(prefix, steps):
    return [PAL[f"{prefix}_{s}"] for s in steps]


def _noise_terrain(seed, ramp, scale=4, octaves=3, contrast=1.0):
    """Generic seamless terrain fill: map tileable noise -> a color ramp.

    Uses a *blended* dither: instead of hard Bayer thresholding between two
    high-contrast bands (which produces ugly 50% checkerboards on flat
    regions), we add a little per-pixel noise to the band position so
    transitions break up organically, and we interpolate the actual RGB
    between adjacent ramp colours so neighbouring bands are never maximally
    contrasting.
    """
    rng = new_rng(seed)
    n = value_noise(rng, TILE, TILE, scale, octaves)
    n = np.clip((n - 0.5) * contrast + 0.5, 0, 1)
    # a second, finer noise field used purely to dither band boundaries
    jitter = value_noise(new_rng(seed + "-j"), TILE, TILE, scale * 2, 2)
    # a third, fine high-freq field replaces the ordered Bayer term so band
    # boundaries break up organically instead of forming a regular weave.
    grain = value_noise(new_rng(seed + "-g"), TILE, TILE, max(6, scale * 3), 2)
    arr = canvas()
    levels = len(ramp)
    ramp_np = [np.array(c, dtype=np.float64) for c in ramp]
    for y in range(TILE):
        for x in range(TILE):
            v = n[y, x] + (jitter[y, x] - 0.5) * 0.10 + (grain[y, x] - 0.5) * 0.07
            v = min(0.999, max(0.0, v))
            f = v * (levels - 1)
            idx = int(f)
            frac = f - idx
            idx2 = min(idx + 1, levels - 1)
            # interpolate RGB between the two adjacent ramp colours
            col = ramp_np[idx] * (1 - frac) + ramp_np[idx2] * frac
            put(arr, x, y, tuple(int(round(c)) for c in col))
    return arr, n


def grass():
    arr, n = _noise_terrain("grass", _ramp("grass", ["sh", "dk", "md", "lt", "hi"]),
                            scale=5, octaves=3, contrast=1.15)
    # sprinkle a few bright blades using a second noise field
    rng = new_rng("grass-blades")
    for _ in range(46):
        x = rng.integers(0, TILE); y = rng.integers(0, TILE)
        put(arr, x, y, PAL["grass_hi"])
        if rng.random() < 0.5:
            put(arr, x, (y - 1), PAL["grass_lt"])
    return to_image(arr)


def tall_grass():
    # base grass, then vertical blade strokes for a taller, bushier look
    base, n = _noise_terrain("tallgrass", _ramp("grass", ["sh", "dk", "md"]),
                            scale=4, octaves=2, contrast=1.0)
    rng = new_rng("tallgrass-blades")
    cols = list(range(0, TILE, 2))
    rng.shuffle(cols)
    for x in cols:
        h = rng.integers(5, 13)
        base_y = rng.integers(0, TILE)
        shade = rng.choice([PAL["grass_md"], PAL["grass_lt"], PAL["grass_hi"]])
        sway = rng.integers(-1, 2)
        for i in range(h):
            yy = (base_y - i)
            xx = x + (sway if i > h // 2 else 0)
            put(base, xx, yy, shade)
            if i == h - 1:
                put(base, xx, yy, PAL["grass_hi"])
    return to_image(base)


def dirt():
    arr, n = _noise_terrain("dirt", _ramp("dirt", ["sh", "dk", "md", "lt", "hi"]),
                            scale=5, octaves=3, contrast=0.85)
    # small pebbles / clods
    rng = new_rng("dirt-clods")
    for _ in range(20):
        x = rng.integers(0, TILE); y = rng.integers(0, TILE)
        put(arr, x, y, PAL["dirt_hi"])
        put(arr, x + 1, y, PAL["dirt_sh"])
    return to_image(arr)


def dark_dirt():
    arr, n = _noise_terrain("ddirt", _ramp("ddirt", ["sh", "dk", "md", "lt"]),
                            scale=5, octaves=3, contrast=0.9)
    rng = new_rng("ddirt-clods")
    for _ in range(16):
        x = rng.integers(0, TILE); y = rng.integers(0, TILE)
        put(arr, x, y, PAL["ddirt_lt"])
    return to_image(arr)


def sand():
    arr, n = _noise_terrain("sand", _ramp("sand", ["sh", "dk", "md", "lt", "hi"]),
                            scale=6, octaves=3, contrast=0.8)
    # faint ripple lines for a beach feel
    rng = new_rng("sand-ripples")
    for _ in range(7):
        y0 = rng.integers(0, TILE)
        amp = rng.integers(1, 3)
        for x in range(TILE):
            y = int(y0 + amp * np.sin(x / 4.0 + rng.random()))
            put(arr, x, y, PAL["sand_hi"])
    return to_image(arr)


def forest_floor():
    arr, n = _noise_terrain("ffloor", _ramp("ffloor", ["sh", "dk", "md", "lt"]),
                            scale=5, octaves=3, contrast=1.1)
    # scatter needles (short diagonal strokes) and leaf flecks
    rng = new_rng("ffloor-litter")
    for _ in range(40):
        x = rng.integers(0, TILE); y = rng.integers(0, TILE)
        c = rng.choice([PAL["grass_dk"], PAL["dirt_md"], PAL["ffloor_lt"]])
        put(arr, x, y, c)
        if rng.random() < 0.4:
            put(arr, x + 1, y + 1, c)
    return to_image(arr)


def stone_ground():
    arr, n = _noise_terrain("stone", _ramp("stone", ["sh", "dk", "md", "lt", "hi"]),
                            scale=5, octaves=3, contrast=0.95)
    # crack lines using a darker shade following low-noise valleys
    rng = new_rng("stone-cracks")
    for _ in range(5):
        x = rng.integers(0, TILE); y = rng.integers(0, TILE)
        steps = rng.integers(8, 18)
        for _ in range(steps):
            put(arr, x, y, PAL["stone_sh"])
            x = (x + rng.integers(-1, 2))
            y = (y + rng.integers(0, 2))
    return to_image(arr)


def path():
    arr, n = _noise_terrain("path", _ramp("path", ["sh", "dk", "md", "lt"]),
                            scale=5, octaves=3, contrast=0.9)
    # embedded stones for a trodden-path look
    rng = new_rng("path-stones")
    for _ in range(14):
        x = rng.integers(1, TILE - 1); y = rng.integers(1, TILE - 1)
        put(arr, x, y, PAL["stone_md"])
        put(arr, x + 1, y, PAL["stone_lt"])
        put(arr, x, y + 1, PAL["stone_dk"])
    return to_image(arr)


TERRAIN = {
    "grass": grass,
    "tall_grass": tall_grass,
    "dirt": dirt,
    "dark_dirt": dark_dirt,
    "sand": sand,
    "forest_floor": forest_floor,
    "stone_ground": stone_ground,
    "path": path,
}
