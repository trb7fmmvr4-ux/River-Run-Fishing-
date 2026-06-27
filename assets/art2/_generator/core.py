"""
River Run Fishing — Phase 1 World Foundation Art Pack
Core module: shared palette, RNG, and pixel-art helper primitives.

Everything is generated procedurally with PIL + numpy at 32x32 (tiles) and
32x32 / 16x16 (objects), using a single cohesive palette derived from the
reference sheet's art direction (deep teal water, layered greens, warm
earth). Helpers here enforce the things that make tiles *usable*: seamless
wrapping, ordered dithering, and palette discipline.
"""

from __future__ import annotations
import numpy as np
from PIL import Image

TILE = 32  # source tile size (downscales cleanly to the 16px world grid)

# ----------------------------------------------------------------------------
# PALETTE  — one shared, deliberately small palette so every asset is cohesive.
# Values picked to echo the reference sheet (saturated but not neon, strong
# value contrast for Terraria-style readability).
# ----------------------------------------------------------------------------
PAL = {
    # grass / foliage greens (dark -> light)
    "grass_sh":   (34,  72,  46),
    "grass_dk":   (43,  92,  56),
    "grass_md":   (58, 120,  68),
    "grass_lt":   (86, 156,  86),
    "grass_hi":   (122, 188, 106),

    # dirt / earth
    "dirt_sh":    (54,  38,  27),
    "dirt_dk":    (74,  52,  35),
    "dirt_md":    (104, 74,  48),
    "dirt_lt":    (134, 98,  64),
    "dirt_hi":    (160, 122, 82),

    # dark dirt (richer, peaty)
    "ddirt_sh":   (33,  25,  21),
    "ddirt_dk":   (48,  37,  30),
    "ddirt_md":   (66,  51,  40),
    "ddirt_lt":   (86,  68,  52),

    # sand
    "sand_sh":    (150, 124, 84),
    "sand_dk":    (182, 154, 104),
    "sand_md":    (208, 182, 130),
    "sand_lt":    (230, 208, 158),
    "sand_hi":    (244, 228, 184),

    # stone
    "stone_sh":   (52,  56,  62),
    "stone_dk":   (74,  80,  88),
    "stone_md":   (104, 110, 120),
    "stone_lt":   (140, 146, 156),
    "stone_hi":   (176, 182, 192),

    # forest floor (earth + needles/leaves)
    "ffloor_sh":  (40,  44,  30),
    "ffloor_dk":  (56,  58,  38),
    "ffloor_md":  (78,  74,  48),
    "ffloor_lt":  (100, 92,  60),

    # path
    "path_sh":    (96,  78,  56),
    "path_dk":    (124, 104, 76),
    "path_md":    (152, 130, 98),
    "path_lt":    (178, 156, 120),

    # water family (deep -> bright); separate hues per body type
    "river_dk":   (28,  78,  104),
    "river_md":   (42, 108, 138),
    "river_lt":   (78, 150, 178),
    "river_hi":   (138, 200, 220),

    "lake_dk":    (26,  70,  92),
    "lake_md":    (38,  96,  122),
    "lake_lt":    (70, 138, 164),
    "lake_hi":    (128, 188, 206),

    "ocean_dk":   (18,  56,  82),
    "ocean_md":   (28,  82,  112),
    "ocean_lt":   (56, 124, 158),
    "ocean_hi":   (112, 176, 200),

    "deep_dk":    (10,  28,  44),
    "deep_md":    (16,  44,  64),
    "deep_lt":    (30,  66,  90),
    "deep_hi":    (60, 104, 132),

    "swamp_dk":   (30,  44,  34),
    "swamp_md":   (44,  62,  44),
    "swamp_lt":   (66,  86,  58),
    "swamp_hi":   (96, 116, 78),

    # foam / highlights
    "foam":       (224, 240, 244),
    "foam_sh":    (180, 212, 222),

    # wood
    "wood_sh":    (54,  38,  26),
    "wood_dk":    (78,  54,  34),
    "wood_md":    (108, 76,  48),
    "wood_lt":    (140, 102, 66),
    "bark_dk":    (46,  34,  24),

    # flowers
    "flower_red": (206, 76,  72),
    "flower_yel": (236, 198, 92),
    "flower_pnk": (224, 138, 178),
    "flower_wht": (236, 232, 224),
    "flower_pur": (150, 110, 184),
    "stem":       (58, 110, 60),

    # mushrooms
    "mush_red":   (190, 64,  58),
    "mush_brn":   (150, 104, 70),
    "mush_stem":  (224, 214, 192),
    "mush_dot":   (236, 232, 224),

    # reeds
    "reed_dk":    (74, 110, 54),
    "reed_md":    (104, 142, 68),
    "reed_lt":    (150, 180, 96),
    "reed_tip":   (176, 150, 84),
}


def rgb(name):
    return PAL[name]


def new_rng(seed_str: str) -> np.random.Generator:
    """Deterministic per-asset RNG so output is identical every build."""
    seed = abs(hash(seed_str)) % (2**32)
    return np.random.default_rng(seed)


def canvas(w=TILE, h=TILE):
    """Transparent RGBA canvas as a numpy array (h, w, 4)."""
    return np.zeros((h, w, 4), dtype=np.uint8)


def put(arr, x, y, color, a=255):
    """Set a single pixel with wrap-around (keeps tiles seamless)."""
    h, w = arr.shape[:2]
    arr[y % h, x % w] = (*color, a)


def fill(arr, color, a=255):
    arr[:, :, 0] = color[0]
    arr[:, :, 1] = color[1]
    arr[:, :, 2] = color[2]
    arr[:, :, 3] = a


# Bayer 4x4 ordered-dither matrix (0..15) — gives clean retro shading bands
BAYER4 = np.array([
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]) / 16.0


def bayer_at(x, y):
    return BAYER4[y % 4, x % 4]


def dither_band(arr, x, y, lo, hi, t):
    """
    Pick lo or hi at (x,y) based on threshold t (0..1) using the Bayer
    matrix — produces ordered dithering instead of flat fills or noise.
    """
    color = hi if bayer_at(x, y) < t else lo
    put(arr, x, y, color)


def value_noise(rng, w, h, scale, octaves=3):
    """
    Seamless tileable value noise. Sums sine waves travelling in several
    directions (not just axis-aligned), so it avoids the regular diagonal
    grid that a plain sin(x)*cos(y) product produces. Integer wave numbers
    keep it seamless across tile edges.
    """
    acc = np.zeros((h, w), dtype=np.float64)
    amp = 1.0
    freq = scale
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    u = xx / w
    v = yy / h
    for _ in range(octaves):
        f = max(1, int(round(freq)))
        for _ in range(3):
            kx = int(rng.integers(-f, f + 1))
            ky = int(rng.integers(-f, f + 1))
            if kx == 0 and ky == 0:
                kx = f
            ph = rng.uniform(0, 2 * np.pi)
            acc += amp * np.sin(2 * np.pi * (kx * u + ky * v) + ph)
        amp *= 0.5
        freq *= 2
    return (acc - acc.min()) / (acc.max() - acc.min() + 1e-9)


def to_image(arr) -> Image.Image:
    return Image.fromarray(arr, "RGBA")


def shade_ramp(name_prefix, steps):
    """Return a list of palette colors for a family, e.g. shade_ramp('grass', ['sh','dk','md','lt','hi'])."""
    return [PAL[f"{name_prefix}_{s}"] for s in steps]
