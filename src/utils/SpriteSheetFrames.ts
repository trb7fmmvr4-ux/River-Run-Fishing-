import Phaser from 'phaser';

/**
 * Shared plumbing for the art pack loaders (ArtPack, ArtPack2, ArtPack3,
 * ArtPack4).
 *
 * Each pack loads a different manifest shape, but all four end up doing
 * the exact same two things once a manifest entry is in hand: deciding
 * which source rectangles make up its frames, and copying those frames
 * out of a loaded sheet into their own addressable texture. That shared
 * core lived duplicated (near character-for-character) in all four files;
 * it now lives here once. Each pack still owns its own manifest typing,
 * key-naming convention, and queue() sheet list — those differ enough
 * (and are small enough) that merging them would cost more clarity than
 * it saves.
 */

export interface SheetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The two shapes a manifest asset entry's frame data can take. */
export interface FramedAssetEntry {
  animation?: boolean;
  rect?: SheetRect;
  frame_rects?: SheetRect[];
}

/**
 * Resolves a manifest asset entry to the list of source rectangles that
 * make up its frame(s): every `frame_rects` entry if it's animated,
 * otherwise its single `rect` as a one-element list, or an empty list if
 * neither is present.
 */
export function framesFromEntry(entry: FramedAssetEntry): SheetRect[] {
  if (entry.animation) return entry.frame_rects ?? [];
  return entry.rect ? [entry.rect] : [];
}

/**
 * Copies `rects` out of the texture at `sourceKey` into a fresh,
 * addressable texture registered under `textureKey`, one rect per frame
 * (frame index order == `rects` order). No-ops (returns `true`) if
 * `textureKey` is already registered, so calling this for the same asset
 * twice is always safe.
 *
 * Returns `false` (and registers nothing) if the source sheet isn't a
 * real loaded texture — callers are expected to log a pack-specific
 * warning in that case, since only they know the asset/category name
 * worth naming in the message.
 */
export function registerFramesFromSheet(
  scene: Phaser.Scene,
  textureKey: string,
  sourceKey: string,
  rects: SheetRect[]
): boolean {
  if (scene.textures.exists(textureKey)) return true;

  const source = scene.textures.get(sourceKey);
  if (!source || source.key === '__MISSING') return false;

  const newTexture = scene.textures.addImage(textureKey, source.getSourceImage() as HTMLImageElement);
  if (!newTexture) return false;

  rects.forEach((r, i) => newTexture.add(i, 0, r.x, r.y, r.w, r.h));
  return true;
}
