import Phaser from 'phaser';
import { PLAYER, TEXTURE_KEYS, WORLD } from '../config/GameConfig';

/**
 * Generates lightweight placeholder textures at runtime so the project is
 * playable with zero external art assets.
 *
 * Every texture created here is intended to be swapped for real pixel-art
 * sprites once the Visual Presentation pass begins. Nothing downstream
 * should depend on these being procedural — they are only ever referenced
 * by their TEXTURE_KEYS, so swapping them later is a one-file change.
 */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  generatePlayerTexture(scene);
  generateGroundTileTexture(scene);
  generateBobberTexture(scene);
}

function generatePlayerTexture(scene: Phaser.Scene): void {
  const size = PLAYER.SIZE + 8;
  const radius = PLAYER.SIZE / 2;
  const cx = size / 2;
  const cy = size / 2;

  const g = scene.make.graphics({ x: 0, y: 0 });

  // Soft shadow, anchored slightly below the body.
  g.fillStyle(0x05080a, 0.35);
  g.fillEllipse(cx, cy + radius * 0.7, radius * 1.6, radius * 0.8);

  // Body.
  g.fillStyle(0xf4c170, 1);
  g.fillCircle(cx, cy, radius);

  // Facing "nose" — gives setFlipX() something visible to flip, even
  // before real directional sprites exist.
  g.fillStyle(0xffffff, 0.9);
  g.fillTriangle(
    cx + radius * 0.3,
    cy - radius * 0.5,
    cx + radius * 0.3,
    cy + radius * 0.5,
    cx + radius * 1.4,
    cy
  );

  g.generateTexture(TEXTURE_KEYS.PLAYER, size, size);
  g.destroy();
}

function generateGroundTileTexture(scene: Phaser.Scene): void {
  const tile = WORLD.TILE_SIZE;

  const g = scene.make.graphics({ x: 0, y: 0 });

  g.fillStyle(0x2b4a33, 1);
  g.fillRect(0, 0, tile, tile);

  // Subtle 1px grid line so the tiling pattern reads clearly until real
  // ground art exists.
  g.fillStyle(0x32533c, 1);
  g.fillRect(0, 0, tile, 1);
  g.fillRect(0, 0, 1, tile);

  g.generateTexture(TEXTURE_KEYS.GROUND_TILE, tile, tile);
  g.destroy();
}

function generateBobberTexture(scene: Phaser.Scene): void {
  const size = 10;
  const radius = size / 2;

  const g = scene.make.graphics({ x: 0, y: 0 });

  g.fillStyle(0xd1453b, 1);
  g.fillCircle(radius, radius, radius);

  // Small glossy highlight so it doesn't read as a flat dot.
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(radius - 1.5, radius - 1.5, radius * 0.35);

  g.lineStyle(1, 0x3a1410, 0.7);
  g.strokeCircle(radius, radius, radius - 0.5);

  g.generateTexture(TEXTURE_KEYS.BOBBER, size, size);
  g.destroy();
}
