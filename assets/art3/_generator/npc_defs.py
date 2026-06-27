"""
Phase 3 — NPC roster, built on the same character renderer as the player.

Each NPC is a palette/hat variation, proving the "future NPCs fit the system"
requirement literally: they ARE the system, just different data. NPCs get a
smaller animation set (idle + walk in 4 directions) since they don't fight or
fish; that's enough for a living village and trivial to extend later.
"""

from __future__ import annotations
from character_render import default_char

# Player is defined in the build script; these are the NPCs.
NPCS = {
    # Old Fisherman — grey beard, weathered, straw hat, blue coat
    "old_fisherman": default_char(
        skin=(214, 176, 142), hair=(210, 210, 206), hat=(176, 150, 96),
        shirt=(70, 96, 130), pants=(72, 64, 56), boots=(54, 44, 34),
        hat_style="straw"),
    # Villager A — plain, capless
    "villager_a": default_char(
        skin=(228, 184, 146), hair=(120, 80, 50), hat=(120, 80, 50),
        shirt=(168, 96, 84), pants=(80, 78, 92), boots=(70, 54, 40),
        hat_style="none"),
    # Villager B — apron, cap
    "villager_b": default_char(
        skin=(208, 162, 120), hair=(60, 44, 32), hat=(150, 130, 100),
        shirt=(120, 150, 110), pants=(90, 80, 70), boots=(66, 50, 38),
        hat_style="cap"),
    # Merchant — richer clothes, gold-trimmed hat
    "merchant": default_char(
        skin=(222, 178, 138), hair=(70, 50, 36), hat=(150, 120, 60),
        shirt=(120, 84, 150), pants=(70, 56, 44), boots=(80, 60, 42),
        hat_style="brim"),
    # Angler — fellow fisherman, green vest + brim hat (player-like but distinct palette)
    "angler": default_char(
        skin=(216, 170, 128), hair=(90, 62, 40), hat=(130, 110, 70),
        shirt=(96, 130, 120), pants=(78, 70, 64), boots=(60, 48, 36),
        hat_style="brim"),
}
