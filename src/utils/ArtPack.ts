import Phaser from 'phaser';
import { framesFromEntry, registerFramesFromSheet, type FramedAssetEntry } from './SpriteSheetFrames';

/**
 * Loader + accessor for the Phase 1 World Foundation Art Pack.
 *
 * This is purely additive: it does not touch any gameplay system. It loads
 * the packed sprite sheets and registers each asset as a Phaser texture (or
 * a spritesheet-with-frames for animated assets) using the pack's
 * manifest.json, so the rest of the game can reference art by stable keys.
 *
 * INTEGRATION (optional, one place):
 *   In PreloadScene.preload(), before generating placeholder textures, call:
 *       ArtPack.queue(this);
 *   and in PreloadScene.create(), after the load completes, call:
 *       ArtPack.register(this);
 *   Nothing else needs to change — existing placeholder generation can stay
 *   as a fallback until each tile is swapped to a real key at the point of
 *   use. See assets/art/INTEGRATION.md for the full plan.
 *
 * Texture key convention: `art:<category>:<asset>` e.g. `art:terrain:grass`,
 * `art:water:river`, `art:nature:pine_tree`.
 */

const MANIFEST_KEY = 'art-pack-manifest';
const ART_BASE = 'assets/art';

interface AssetEntry extends FramedAssetEntry {
  sheet: string;
  frames: number;
  size: [number, number];
}

interface Manifest {
  pack: string;
  version: string;
  tile_size: number;
  categories: Record<string, { sheet: string; assets: Record<string, AssetEntry> }>;
}

export const ArtPack = {
  /** Queue the manifest + all category sheets for loading. Call in preload(). */
  queue(scene: Phaser.Scene): void {
    scene.load.json(MANIFEST_KEY, `${ART_BASE}/manifest.json`);
    // The sheets themselves are loaded once the manifest is available; Phaser
    // processes JSON before the create() phase, so we read it there and load
    // sheets via a second pass. To keep a single load pass, we instead load
    // the known category sheets directly here by their stable paths.
    const sheets: Record<string, string> = {
      'sheet:terrain': `${ART_BASE}/terrain/terrain_sheet.png`,
      'sheet:water': `${ART_BASE}/water/water_sheet.png`,
      'sheet:shorelines': `${ART_BASE}/shorelines/shorelines_sheet.png`,
      'sheet:nature': `${ART_BASE}/nature/nature_sheet.png`,
      'sheet:effects': `${ART_BASE}/effects/effects_sheet.png`
    };
    for (const [key, path] of Object.entries(sheets)) {
      scene.load.image(key, path);
    }
  },

  /**
   * Register every manifest asset as an addressable texture by slicing the
   * loaded sheets. Call in create(), after the loader has finished.
   */
  register(scene: Phaser.Scene): void {
    const manifest = scene.cache.json.get(MANIFEST_KEY) as Manifest | undefined;
    if (!manifest) {
      console.warn('[ArtPack] manifest not loaded; skipping registration.');
      return;
    }

    for (const [categoryName, category] of Object.entries(manifest.categories)) {
      const sheetKey = `sheet:${categoryName}`;
      if (!scene.textures.exists(sheetKey) || scene.textures.get(sheetKey).key === '__MISSING') {
        console.warn(`[ArtPack] sheet '${sheetKey}' missing; skipping ${categoryName}.`);
        continue;
      }

      for (const [assetName, entry] of Object.entries(category.assets)) {
        const textureKey = `art:${categoryName}:${assetName}`;
        registerFramesFromSheet(scene, textureKey, sheetKey, framesFromEntry(entry));
      }
    }

    console.info(`[ArtPack] registered '${manifest.pack}' v${manifest.version}.`);
  },

  /** Build the texture key for an asset. */
  key(category: string, asset: string): string {
    return `art:${category}:${asset}`;
  }
};
