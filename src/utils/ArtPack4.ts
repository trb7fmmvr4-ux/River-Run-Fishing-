import Phaser from 'phaser';
import { framesFromEntry, registerFramesFromSheet, type FramedAssetEntry } from './SpriteSheetFrames';

/**
 * Loader + accessor for the Phase 4 Buildings, UI & Expansion Foundation Pack.
 *
 * Parallel to ArtPack.ts / ArtPack2.ts / ArtPack3.ts and equally additive —
 * it touches no gameplay system. Loads the packed sheets and registers each
 * asset/frame from manifest.json.
 *
 * Registered texture keys:
 *   building: `building:<id>`     e.g. `building:shop`, `building:lodge_wall`
 *   decor:    `decor:<id>`        e.g. `decor:bed`, `decor:fish_mount_bass`
 *   ui:       `ui:<id>`           e.g. `ui:icon_gold`, `ui:button_normal`, `ui:panel_default`
 *   effect:   `effect:<id>`       e.g. `effect:legendary_catch` (animated, frames 0..n-1)
 *   reserved: `reserved:<id>`     placeholder markers for future content (not for shipping use)
 *
 * INTEGRATION (optional, one place), alongside the other packs:
 *   // preload()
 *   ArtPack4.queue(this);
 *   // create()
 *   ArtPack4.register(this);
 */

const MANIFEST_KEY = 'art-pack4-manifest';
const ART_BASE = 'assets/art4';

interface AssetEntry extends FramedAssetEntry {
  sheet: string;
  group?: string;
  frames: number;
  size: [number, number];
  reserved?: boolean;
}
interface Category {
  sheet?: string;
  sheets?: Record<string, string>;
  assets: Record<string, AssetEntry>;
}
interface Manifest {
  pack: string;
  version: string;
  categories: Record<string, Category>;
}

// category name in manifest -> singular key prefix used at call sites
const KEY_PREFIX: Record<string, string> = {
  buildings: 'building',
  decor: 'decor',
  ui: 'ui',
  effects: 'effect',
  expansion: 'reserved'
};

function sheetKey(path: string): string {
  return `sheet4:${path}`;
}

export const ArtPack4 = {
  /** Queue the manifest + every sheet. Call in preload(). */
  queue(scene: Phaser.Scene): void {
    scene.load.json(MANIFEST_KEY, `${ART_BASE}/manifest.json`);
    const paths = [
      'buildings/buildings_sheet.png',
      'decor/decor_sheet.png',
      'ui/ui_icons_sheet.png',
      'ui/ui_buttons_sheet.png',
      'ui/ui_panels_sheet.png',
      'effects/effects_sheet.png',
      'expansion/expansion_reserved_sheet.png'
    ];
    for (const p of paths) scene.load.image(sheetKey(p), `${ART_BASE}/${p}`);
  },

  /** Register every manifest asset as an addressable texture. Call in create(). */
  register(scene: Phaser.Scene): void {
    const manifest = scene.cache.json.get(MANIFEST_KEY) as Manifest | undefined;
    if (!manifest) {
      console.warn('[ArtPack4] manifest not loaded; skipping registration.');
      return;
    }

    for (const [categoryName, category] of Object.entries(manifest.categories)) {
      const prefix = KEY_PREFIX[categoryName] ?? categoryName;

      for (const [assetName, entry] of Object.entries(category.assets)) {
        const textureKey = `${prefix}:${assetName}`;
        if (scene.textures.exists(textureKey)) continue;

        const ok = registerFramesFromSheet(scene, textureKey, sheetKey(entry.sheet), framesFromEntry(entry));
        if (!ok) {
          console.warn(`[ArtPack4] sheet '${entry.sheet}' missing; skipping ${assetName}.`);
        }
      }
    }

    console.info(`[ArtPack4] registered '${manifest.pack}' v${manifest.version}.`);
  },

  buildingKey(id: string): string { return `building:${id}`; },
  decorKey(id: string): string { return `decor:${id}`; },
  uiKey(id: string): string { return `ui:${id}`; },
  effectKey(id: string): string { return `effect:${id}`; }
};
