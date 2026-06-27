"""Water tiles: river, lake, ocean, deep, swamp.
Each generated as a 4-frame seamless looping ripple animation."""

from __future__ import annotations
import numpy as np
from core import TILE, PAL, canvas, put, to_image, new_rng

WATER_FRAMES = 4


def _ramp(prefix):
    return [PAL[f"{prefix}_dk"], PAL[f"{prefix}_md"], PAL[f"{prefix}_lt"], PAL[f"{prefix}_hi"]]


def _water_frame(prefix, frame, total, seed, swell=1.0, sparkle=True):
    """
    One animation frame. Uses summed sine waves whose phase advances with
    `frame` so the loop is seamless in time, and integer spatial frequencies
    so it's seamless in space.
    """
    ramp = _ramp(prefix)
    arr = canvas()
    rng = new_rng(seed)
    t = 2 * np.pi * frame / total

    # a few wave components (integer freqs -> spatially seamless)
    comps = []
    for _ in range(4):
        fx = rng.integers(1, 4)
        fy = rng.integers(1, 4)
        ph = rng.uniform(0, 2 * np.pi)
        sp = rng.choice([-1, 1])
        comps.append((fx, fy, ph, sp))

    for y in range(TILE):
        for x in range(TILE):
            v = 0.0
            for (fx, fy, ph, sp) in comps:
                v += np.sin(2 * np.pi * (fx * x / TILE + fy * y / TILE) + ph + sp * t)
            v = v / len(comps)
            v = (v + 1) / 2  # 0..1
            v = np.clip((v - 0.5) * swell + 0.5, 0, 1)
            idx = int(v * (len(ramp) - 1) + 0.5)
            put(arr, x, y, ramp[idx])

    # sparkle highlights on the wave crests (top band)
    if sparkle:
        for y in range(TILE):
            for x in range(TILE):
                v = 0.0
                for (fx, fy, ph, sp) in comps:
                    v += np.sin(2 * np.pi * (fx * x / TILE + fy * y / TILE) + ph + sp * t)
                v = v / len(comps)
                if v > 0.82 and (x + y + frame) % 3 == 0:
                    put(arr, x, y, PAL["foam"], a=200)
    return arr


def _animated(prefix, seed, swell=1.0, sparkle=True):
    return [to_image(_water_frame(prefix, f, WATER_FRAMES, f"{seed}-{f}", swell, sparkle))
            for f in range(WATER_FRAMES)]


def river():
    return _animated("river", "river-water", swell=1.1, sparkle=True)


def lake():
    return _animated("lake", "lake-water", swell=0.85, sparkle=True)


def ocean():
    return _animated("ocean", "ocean-water", swell=1.25, sparkle=True)


def deep():
    return _animated("deep", "deep-water", swell=0.7, sparkle=False)


def swamp():
    frames = _animated("swamp", "swamp-water", swell=0.6, sparkle=False)
    # add a little murk: scattered darker flecks + occasional algae green
    out = []
    for i, im in enumerate(frames):
        arr = np.array(im)
        rng = new_rng(f"swamp-murk-{i}")
        for _ in range(26):
            x = rng.integers(0, TILE); y = rng.integers(0, TILE)
            arr[y, x] = (*PAL["swamp_dk"], 255)
        for _ in range(10):
            x = rng.integers(0, TILE); y = rng.integers(0, TILE)
            arr[y, x] = (*PAL["reed_dk"], 200)
        out.append(to_image(arr))
    return out


WATER = {
    "river": river,
    "lake": lake,
    "ocean": ocean,
    "deep_water": deep,
    "swamp": swamp,
}
