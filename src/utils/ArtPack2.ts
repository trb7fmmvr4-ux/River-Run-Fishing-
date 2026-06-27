import Phaser from 'phaser';
import { framesFromEntry, registerFramesFromSheet, type FramedAssetEntry } from './SpriteSheetFrames';

/**
 * Loader + accessor for the Phase 2 Fishing & Creature Art Pack.
 *
 * Parallel to ArtPack.ts (Phase 1) and equally additive — it touches no
 * gameplay system. It loads the packed sheets and registers each asset as a
 * Phaser texture/frame from manifest.json.
 *
 * The fish category is split into one sheet PER RARITY (common, uncommon,
 * rare, legendary, exotic); each fish entry names its own sheet, so this
 * loader keys sheets by their manifest path rather than by category.
 *
 * Texture key convention: `fish:<id>`, `gear:<id>`, `loot:<id>`,
 * `creature:<id>` — e.g. `fish:gilded-koi`, `gear:rod_starter`,
 * `loot:treasure_map`, `creature:dragonfly`.
 *
 * INTEGRATION (optional, one place), alongside the Phase 1 call:
 *   // preload()
 *   ArtPack2.queue(this);
 *   // create()
 *   ArtPack2.register(this);
 */

const MANIFEST_KEY = 'art-pack2-manifest';
const ART_BASE = 'assets/art2';

interface AssetEntry extends FramedAssetEntry {
  sheet: string;
  rarity?: string;
  name?: string;
  frames: number;
  size: [number, number];
}

interface Category {
  sheet?: string;
  sheets_by_rarity?: Record<string, string>;
  assets: Record<string, AssetEntry>;
}

interface Manifest {
  pack: string;
  version: string;
  categories: Record<string, Category>;
}

// Per-category texture-key prefix (singular reads better at call sites).
const KEY_PREFIX: Record<string, string> = {
  fish: 'fish',
  gear: 'gear',
  loot: 'loot',
  creatures: 'creature'
};

function sheetCacheKey(sheetPath: string): string {
  // e.g. 'fish/fish_rare_sheet.png' -> 'sheet2:fish/fish_rare_sheet.png'
  return `sheet2:${sheetPath}`;
}

export const ArtPack2 = {
  /** Queue the manifest + every sheet referenced by it. Call in preload(). */
  queue(scene: Phaser.Scene): void {
    scene.load.json(MANIFEST_KEY, `${ART_BASE}/manifest.json`);

    // The full set of sheets is known and stable, so load them directly in
    // this single pass (mirrors the Phase 1 loader's approach).
    const sheetPaths = [
      'fish/fish_common_sheet.png',
      'fish/fish_uncommon_sheet.png',
      'fish/fish_rare_sheet.png',
      'fish/fish_legendary_sheet.png',
      'fish/fish_exotic_sheet.png',
      'gear/gear_sheet.png',
      'loot/loot_sheet.png',
      'creatures/creatures_sheet.png'
    ];
    for (const path of sheetPaths) {
      scene.load.image(sheetCacheKey(path), `${ART_BASE}/${path}`);
    }
  },

  /** Register every manifest asset as an addressable texture. Call in create(). */
  register(scene: Phaser.Scene): void {
    const manifest = scene.cache.json.get(MANIFEST_KEY) as Manifest | undefined;
    if (!manifest) {
      console.warn('[ArtPack2] manifest not loaded; skipping registration.');
      return;
    }

    for (const [categoryName, category] of Object.entries(manifest.categories)) {
      const prefix = KEY_PREFIX[categoryName] ?? categoryName;

      for (const [assetName, entry] of Object.entries(category.assets)) {
        const textureKey = `${prefix}:${assetName}`;
        if (scene.textures.exists(textureKey)) continue;

        const srcKey = sheetCacheKey(entry.sheet);
        const ok = registerFramesFromSheet(scene, textureKey, srcKey, framesFromEntry(entry));
        if (!ok) {
          console.warn(`[ArtPack2] sheet '${srcKey}' missing; skipping ${assetName}.`);
        }
      }
    }

    console.info(`[ArtPack2] registered '${manifest.pack}' v${manifest.version}.`);
  },

  /** Build a texture key. category is one of 'fish' | 'gear' | 'loot' | 'creature'. */
  key(category: string, asset: string): string {
    return `${category}:${asset}`;
  }
};
