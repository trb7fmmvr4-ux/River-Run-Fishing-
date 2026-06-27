"""Shoreline tiles: the land<->water transition set.

A standard 'blob'-style transition set: 4 straight edges, 4 outer corners,
4 inner corners, plus a couple of curve variants. Each tile is sand on the
land side, water on the water side, with a foam line on the boundary so the
shore reads clearly. Built so that placing the right tile by neighbour mask
gives a continuous, natural coastline.
"""

from __future__ import annotations
import numpy as np
from core import TILE, PAL, canvas, put, to_image, new_rng

# Which side(s) are WATER for each named tile. Land is the remainder.
# Directions on the tile: we treat -y as North (top), +y South, +x East, -x West.

SAND = ["sand_sh", "sand_dk", "sand_md", "sand_lt"]
WAT = ["lake_dk", "lake_md", "lake_lt"]


def _sand_px(rng, x, y):
    n = (np.sin(x * 0.7) + np.cos(y * 0.6)) * 0.5
    r = rng.random() * 0.4 + (n + 1) / 2 * 0.6
    idx = int(r * (len(SAND) - 1) + 0.5)
    return PAL[SAND[idx]]


def _water_px(rng, x, y):
    n = (np.sin(x * 0.5 + y * 0.3)) * 0.5
    r = rng.random() * 0.4 + (n + 1) / 2 * 0.6
    idx = int(r * (len(WAT) - 1) + 0.5)
    return PAL[WAT[idx]]


def _boundary_jitter(rng, base, span=2):
    """Return a per-coordinate wavy offset for a natural (non-straight) shore."""
    return base + rng.integers(-span, span + 1)


def _render(mask_fn, seed):
    """
    mask_fn(x, y, rng_line) -> True if this pixel is WATER.
    A foam band is drawn where land meets water.
    """
    arr = canvas()
    rng = new_rng(seed)
    water = np.zeros((TILE, TILE), dtype=bool)
    for y in range(TILE):
        for x in range(TILE):
            water[y, x] = mask_fn(x, y, rng)

    # One pass of majority smoothing so the coastline isn't pixel-noisy
    # (keeps the overall shape from mask_fn, just cleans single-pixel jaggies).
    smooth = water.copy()
    for y in range(TILE):
        for x in range(TILE):
            cnt = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if water[(y + dy) % TILE, (x + dx) % TILE]:
                        cnt += 1
            smooth[y, x] = cnt >= 5
    water = smooth

    for y in range(TILE):
        for x in range(TILE):
            if water[y, x]:
                put(arr, x, y, _water_px(rng, x, y))
            else:
                put(arr, x, y, _sand_px(rng, x, y))

    # foam: land pixels adjacent to water, plus a lighter water lip
    for y in range(TILE):
        for x in range(TILE):
            if not water[y, x]:
                neigh = False
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if water[(y + dy) % TILE, (x + dx) % TILE]:
                        neigh = True; break
                if neigh and rng.random() < 0.85:
                    put(arr, x, y, PAL["foam"])
            else:
                neigh_land = False
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if not water[(y + dy) % TILE, (x + dx) % TILE]:
                        neigh_land = True; break
                if neigh_land and rng.random() < 0.5:
                    put(arr, x, y, PAL["foam_sh"], a=220)
    return to_image(arr)


def _line(base):
    """Small helper: wavy boundary position around `base` per column/row."""
    return base


# ---- Straight edges (water on one side) -----------------------------------

def edge_n():
    # water along the top
    def m(x, y, rng):
        b = _line(13) + int(2 * np.sin(x / 5.0))
        return y < b
    return _render(m, "edge_n")


def edge_s():
    def m(x, y, rng):
        b = _line(19) + int(2 * np.sin(x / 5.0))
        return y > b
    return _render(m, "edge_s")


def edge_e():
    def m(x, y, rng):
        b = _line(19) + int(2 * np.sin(y / 5.0))
        return x > b
    return _render(m, "edge_e")


def edge_w():
    def m(x, y, rng):
        b = _line(13) + int(2 * np.sin(y / 5.0))
        return x < b
    return _render(m, "edge_w")


# ---- Outer corners (water wraps the corner) -------------------------------

def corner_ne():
    def m(x, y, rng):
        return (y < 15 + int(1.5 * np.sin(x / 5.0))) and (x > 17 + int(1.5 * np.sin(y / 5.0)))
    return _render(m, "corner_ne")


def corner_nw():
    def m(x, y, rng):
        return (y < 15 + int(1.5 * np.sin(x / 5.0))) and (x < 15 + int(1.5 * np.sin(y / 5.0)))
    return _render(m, "corner_nw")


def corner_se():
    def m(x, y, rng):
        return (y > 17 + int(1.5 * np.sin(x / 5.0))) and (x > 17 + int(1.5 * np.sin(y / 5.0)))
    return _render(m, "corner_se")


def corner_sw():
    def m(x, y, rng):
        return (y > 17 + int(1.5 * np.sin(x / 5.0))) and (x < 15 + int(1.5 * np.sin(y / 5.0)))
    return _render(m, "corner_sw")


# ---- Inner corners (land notch into water) --------------------------------

def inner_ne():
    def m(x, y, rng):
        return not ((y > 17) and (x < 15))
    return _render(m, "inner_ne")


def inner_nw():
    def m(x, y, rng):
        return not ((y > 17) and (x > 17))
    return _render(m, "inner_nw")


def inner_se():
    def m(x, y, rng):
        return not ((y < 15) and (x < 15))
    return _render(m, "inner_se")


def inner_sw():
    def m(x, y, rng):
        return not ((y < 15) and (x > 17))
    return _render(m, "inner_sw")


# ---- Curves (rounded diagonal coast) --------------------------------------

def curve_ne():
    def m(x, y, rng):
        dx = x - 6; dy = y - 26
        return (dx * dx + dy * dy) < 22 * 22
    return _render(m, "curve_ne")


def curve_sw():
    def m(x, y, rng):
        dx = x - 26; dy = y - 6
        return (dx * dx + dy * dy) < 22 * 22
    return _render(m, "curve_sw")


SHORELINES = {
    "edge_n": edge_n, "edge_s": edge_s, "edge_e": edge_e, "edge_w": edge_w,
    "corner_ne": corner_ne, "corner_nw": corner_nw, "corner_se": corner_se, "corner_sw": corner_sw,
    "inner_ne": inner_ne, "inner_nw": inner_nw, "inner_se": inner_se, "inner_sw": inner_sw,
    "curve_ne": curve_ne, "curve_sw": curve_sw,
}
