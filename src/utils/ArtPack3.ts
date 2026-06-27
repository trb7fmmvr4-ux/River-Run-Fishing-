import Phaser from 'phaser';
import { registerFramesFromSheet, type SheetRect } from './SpriteSheetFrames';

/**
 * Loader + accessor for the Phase 3 Character & Combat Art Pack.
 *
 * Parallel to ArtPack.ts / ArtPack2.ts and equally additive — it touches no
 * gameplay system. Loads the per-state animation sheets and registers each
 * frame from manifest.json.
 *
 * Frame layout in the sheets:
 *   - Player & NPCs: one sheet per pose; each DIRECTION is its own row,
 *     frames run left-to-right within the row.
 *   - Enemies & boss: one sheet per character; each STATE is its own row,
 *     frames run left-to-right.
 *
 * Registered texture keys (one texture per character, frames added by index):
 *   player: `player:<pose>:<direction>`   e.g. `player:walk:down`
 *   npc:    `npc:<id>:<pose>:<direction>`  e.g. `npc:merchant:idle:left`
 *   enemy:  `enemy:<id>:<state>`           e.g. `enemy:green_slime:attack`
 *   boss:   `boss:<id>:<state>`            e.g. `boss:fish_king:special`
 *
 * Each registered texture's frames are indexed 0..n-1 in play order, so a
 * Phaser anim is `frames: tex.generateFrameNumbers(key)`.
 *
 * INTEGRATION (optional, one place), alongside the other packs:
 *   // preload()
 *   ArtPack3.queue(this);
 *   // create()
 *   ArtPack3.register(this);
 */

const MANIFEST_KEY = 'art-pack3-manifest';
const ART_BASE = 'assets/art3';

interface DirEntry { frames: number; frame_rects: SheetRect[]; }
interface PoseEntry { sheet: string; directions: Record<string, DirEntry>; frame_size: [number, number]; }
interface StateEntry { frames: number; frame_rects: SheetRect[]; }
interface EnemyEntry { sheet: string; states: Record<string, StateEntry>; }

interface Manifest {
  pack: string;
  version: string;
  directions: string[];
  categories: {
    player: { poses: Record<string, PoseEntry> };
    npcs: { characters: Record<string, Record<string, PoseEntry>> };
    enemies: { creatures: Record<string, EnemyEntry> };
    boss: { bosses: Record<string, EnemyEntry> };
  };
}

function sheetKey(path: string): string {
  return `sheet3:${path}`;
}

/** Thin pack-specific wrapper: resolves the sheet path to this pack's cache key, and logs its own warning style on a miss. */
function registerFrames(scene: Phaser.Scene, textureKey: string, sheetPath: string, rects: SheetRect[]): void {
  const ok = registerFramesFromSheet(scene, textureKey, sheetKey(sheetPath), rects);
  if (!ok) {
    console.warn(`[ArtPack3] sheet '${sheetPath}' missing; skipping ${textureKey}.`);
  }
}

export const ArtPack3 = {
  /** Queue the manifest + every sheet. Call in preload(). */
  queue(scene: Phaser.Scene): void {
    scene.load.json(MANIFEST_KEY, `${ART_BASE}/manifest.json`);

    const poses = ['idle', 'walk', 'run', 'cast', 'reel', 'attack', 'hurt', 'death'];
    const npcPoses = ['idle', 'walk'];
    const npcs = ['old_fisherman', 'villager_a', 'villager_b', 'merchant', 'angler'];
    const enemies = ['green_slime', 'blue_slime', 'bat', 'cave_bat', 'swamp_creature'];

    const paths: string[] = [];
    for (const p of poses) paths.push(`player/player_${p}_sheet.png`);
    for (const n of npcs) for (const p of npcPoses) paths.push(`npcs/${n}_${p}_sheet.png`);
    for (const e of enemies) paths.push(`enemies/${e}_sheet.png`);
    paths.push('boss/fish_king_sheet.png');

    for (const path of paths) {
      scene.load.image(sheetKey(path), `${ART_BASE}/${path}`);
    }
  },

  /** Register all character frames as addressable textures. Call in create(). */
  register(scene: Phaser.Scene): void {
    const manifest = scene.cache.json.get(MANIFEST_KEY) as Manifest | undefined;
    if (!manifest) {
      console.warn('[ArtPack3] manifest not loaded; skipping registration.');
      return;
    }

    const c = manifest.categories;

    // Player
    for (const [pose, entry] of Object.entries(c.player.poses)) {
      for (const [dir, de] of Object.entries(entry.directions)) {
        registerFrames(scene, `player:${pose}:${dir}`, entry.sheet, de.frame_rects);
      }
    }

    // NPCs
    for (const [npcId, poseMap] of Object.entries(c.npcs.characters)) {
      for (const [pose, entry] of Object.entries(poseMap)) {
        for (const [dir, de] of Object.entries(entry.directions)) {
          registerFrames(scene, `npc:${npcId}:${pose}:${dir}`, entry.sheet, de.frame_rects);
        }
      }
    }

    // Enemies
    for (const [enemyId, entry] of Object.entries(c.enemies.creatures)) {
      for (const [state, se] of Object.entries(entry.states)) {
        registerFrames(scene, `enemy:${enemyId}:${state}`, entry.sheet, se.frame_rects);
      }
    }

    // Boss
    for (const [bossId, entry] of Object.entries(c.boss.bosses)) {
      for (const [state, se] of Object.entries(entry.states)) {
        registerFrames(scene, `boss:${bossId}:${state}`, entry.sheet, se.frame_rects);
      }
    }

    console.info(`[ArtPack3] registered '${manifest.pack}' v${manifest.version}.`);
  },

  /** Key helpers. */
  playerKey(pose: string, direction: string): string {
    return `player:${pose}:${direction}`;
  },
  npcKey(id: string, pose: string, direction: string): string {
    return `npc:${id}:${pose}:${direction}`;
  },
  enemyKey(id: string, state: string): string {
    return `enemy:${id}:${state}`;
  },
  bossKey(id: string, state: string): string {
    return `boss:${id}:${state}`;
  }
};
