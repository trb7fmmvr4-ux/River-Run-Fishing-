import Phaser from 'phaser';
import { TEXTURE_KEYS } from '../config/GameConfig';
import { ArtPack } from './ArtPack';
import { ArtPack2 } from './ArtPack2';
import { ArtPack3 } from './ArtPack3';
import { ArtPack4 } from './ArtPack4';

/**
 * Centralized asset pipeline + registry.
 *
 * One place that:
 *   1. queues every art pack's manifest + sheets for loading (queueAll),
 *   2. registers every pack's textures from its manifest (registerAll), and
 *   3. binds the game's existing placeholder TEXTURE_KEYS to real art where
 *      a matching asset exists (bindPlaceholderOverrides), so existing
 *      consumers (Player, Zone, FishingHUD) get real sprites with no change
 *      to those files.
 *
 * This composes the four per-pack loaders (ArtPack..ArtPack4) rather than
 * replacing them — they keep working exactly as before; this is the single
 * front door the game calls, and the single place to register a future pack.
 *
 * Design goals from the integration brief:
 *   - proper loading pipeline: queueAll() in preload, registerAll() in create
 *   - centralized registry: every key resolves through ArtRegistry.* helpers
 *   - easy to extend: add a pack to PACKS below and (optionally) a key helper
 *
 * Graceful degradation: if the art files are missing (e.g. assets not
 * deployed), the per-pack loaders log a warning and the game falls back to
 * the procedural placeholders — nothing crashes.
 */

// The pack loaders, in load order. Adding a future pack = one entry here.
const PACKS = [ArtPack, ArtPack2, ArtPack3, ArtPack4];

/**
 * Maps the three procedural placeholder texture keys to the real art key
 * that should stand in for them, if that art loaded successfully. Each
 * entry is resolved against the live texture cache at bind time; if the
 * real texture isn't present, the placeholder is left untouched.
 */
function placeholderBindings(): { placeholder: string; real: string; frame?: number }[] {
  return [
    // Ground: the Zone tileSprite samples TEXTURE_KEYS.GROUND_TILE.
    // The grass terrain tile is seamless and the natural default ground.
    { placeholder: TEXTURE_KEYS.GROUND_TILE, real: ArtPack.key('terrain', 'grass') },
    // Bobber: FishingHUD sprites TEXTURE_KEYS.BOBBER. The classic red/white
    // bobber from the gear pack is the direct replacement (same ~16px size).
    { placeholder: TEXTURE_KEYS.BOBBER, real: ArtPack2.key('gear', 'bobber_classic') }
    // NOTE: the player is deliberately NOT rebound here. The real character
    // art is 24x32 with its feet near the bottom, whereas Player.ts sizes a
    // 12x12 physics body that Arcade centres within the frame — swapping the
    // texture without also adjusting the body offset (which lives in
    // Player.ts gameplay logic, out of scope for an assets-only pass) would
    // misalign collision with the visual. The full directional rig stays
    // available via ArtRegistry.player(pose, dir) for a dedicated
    // "animate the player" task that can adjust the body correctly.
  ];
}

export const ArtRegistry = {
  /** Queue every pack for loading. Call once in PreloadScene.preload(). */
  queueAll(scene: Phaser.Scene): void {
    for (const pack of PACKS) {
      pack.queue(scene);
    }
  },

  /**
   * Register every pack's textures, then bind placeholder overrides.
   * Call once in PreloadScene.create(), AFTER the loader has finished and
   * AFTER the procedural placeholders have been generated (so the real art
   * overrides them rather than the other way around).
   */
  registerAll(scene: Phaser.Scene): void {
    for (const pack of PACKS) {
      pack.register(scene);
    }
    this.extractTileableTextures(scene);
    this.bindPlaceholderOverrides(scene);
  },

  /**
   * Extracts each animated water frame into its own standalone texture
   * (keys `water-tile:<type>:<frame>`).
   *
   * tileSprite wraps a texture's full bounds; tiling a sub-frame of a
   * packed atlas can repeat the whole sheet instead of just the frame. The
   * water tiles are 32x32 (power-of-two, so they wrap cleanly under WebGL),
   * so copying each frame into its own texture makes them safe to tile.
   * Zone uses these if present.
   */
  extractTileableTextures(scene: Phaser.Scene): void {
    const waterTypes = ['river', 'lake', 'ocean', 'deep_water', 'swamp'];
    for (const type of waterTypes) {
      const srcKey = ArtPack.key('water', type);
      if (!scene.textures.exists(srcKey)) continue;
      const srcTex = scene.textures.get(srcKey);
      const frameNames = srcTex.getFrameNames(); // excludes __BASE
      frameNames.forEach((fname: string) => {
        const f = srcTex.get(fname);
        const outKey = `water-tile:${type}:${fname}`;
        if (scene.textures.exists(outKey)) return;
        const canvasTex = scene.textures.createCanvas(outKey, f.cutWidth, f.cutHeight);
        if (!canvasTex) return;
        const img = srcTex.getSourceImage(fname) as CanvasImageSource;
        canvasTex.context.drawImage(img, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
        canvasTex.refresh();
      });
    }
  },

  /** Standalone tileable water frame key (see extractTileableTextures). */
  waterTile(type: string, frame: number): string {
    return `water-tile:${type}:${frame}`;
  },

  /**
   * Re-point each placeholder TEXTURE_KEY at its real-art equivalent.
   *
   * The real art is usually a sub-rect of a packed sheet, so we copy just
   * that frame's pixels into a fresh standalone texture registered under
   * the placeholder key. This avoids any fragile manipulation of Phaser's
   * internal `__BASE` frame (whose API differs across versions) — the
   * resulting texture is a plain, full-bounds image, exactly like the
   * procedural placeholder it replaces. Existing consumers reference the
   * placeholder key and need no changes.
   */
  bindPlaceholderOverrides(scene: Phaser.Scene): void {
    for (const { placeholder, real, frame } of placeholderBindings()) {
      if (!scene.textures.exists(real)) {
        // Real art not present — leave the procedural placeholder in place.
        continue;
      }

      const realTex = scene.textures.get(real);
      const frameObj = realTex.get(frame ?? 0);
      if (!frameObj) continue;

      const w = frameObj.cutWidth;
      const h = frameObj.cutHeight;
      if (w <= 0 || h <= 0) continue;

      // Build a standalone canvas texture holding just this frame, created
      // DIRECTLY under the placeholder's key (no temp key + rename step).
      // Renaming a freshly-created texture onto an existing key was the
      // actual crash site in production (Phaser threw deep inside its own
      // frame/UV update internals — `updateUVs`, "this.data.drawImage" —
      // after the rename, when a TileSprite later sampled the renamed
      // texture). Removing the old texture and creating the new one
      // straight under the same key avoids that rename path completely:
      // there's never a moment where two textures both reference the same
      // key, and nothing needs remapping after the fact.
      if (scene.textures.exists(placeholder)) scene.textures.remove(placeholder);
      const canvasTex = scene.textures.createCanvas(placeholder, w, h);
      if (!canvasTex) continue;

      const sourceImage = realTex.getSourceImage(frame ?? 0) as CanvasImageSource;
      canvasTex.context.drawImage(
        sourceImage,
        frameObj.cutX,
        frameObj.cutY,
        w,
        h,
        0,
        0,
        w,
        h
      );
      canvasTex.refresh();
    }
  },

  // ---- Key helpers (thin pass-throughs so callers have one import) -------
  terrain(asset: string): string { return ArtPack.key('terrain', asset); },
  water(asset: string): string { return ArtPack.key('water', asset); },
  shoreline(asset: string): string { return ArtPack.key('shorelines', asset); },
  nature(asset: string): string { return ArtPack.key('nature', asset); },
  effectP1(asset: string): string { return ArtPack.key('effects', asset); },

  fish(id: string): string { return ArtPack2.key('fish', id); },
  gear(id: string): string { return ArtPack2.key('gear', id); },
  loot(id: string): string { return ArtPack2.key('loot', id); },
  creature(id: string): string { return ArtPack2.key('creature', id); },

  player(pose: string, dir: string): string { return ArtPack3.playerKey(pose, dir); },
  npc(id: string, pose: string, dir: string): string { return ArtPack3.npcKey(id, pose, dir); },
  enemy(id: string, state: string): string { return ArtPack3.enemyKey(id, state); },
  boss(id: string, state: string): string { return ArtPack3.bossKey(id, state); },

  building(id: string): string { return ArtPack4.buildingKey(id); },
  decor(id: string): string { return ArtPack4.decorKey(id); },
  ui(id: string): string { return ArtPack4.uiKey(id); },
  effect(id: string): string { return ArtPack4.effectKey(id); },

  /** True if a texture key is registered and ready to use. */
  has(scene: Phaser.Scene, key: string): boolean {
    return scene.textures.exists(key);
  }
};
