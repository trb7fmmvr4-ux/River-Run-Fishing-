import Phaser from 'phaser';

/**
 * A small celebratory burst — a handful of tiny circles flying outward
 * from a point, shrinking and fading as they go, then cleaning themselves
 * up. No texture or Phaser ParticleEmitter dependency (this project has
 * none yet); just tweened shapes, the same low-tech-but-effective approach
 * already used throughout this UI (Notifications, the hotbar flash, etc).
 *
 * Intentionally generic (not tied to quests specifically) — any future
 * "celebrate this moment" use (level up, rare catch, achievement) can
 * call this directly.
 */
export function spawnParticleBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: { count?: number; color?: number; depth?: number; radius?: number } = {}
): void {
  const count = options.count ?? 8;
  const color = options.color ?? 0xf4c170;
  const depth = options.depth ?? 9500;
  const travel = options.radius ?? 22;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
    const dist = travel * Phaser.Math.FloatBetween(0.7, 1.15);
    const dot = scene.add.circle(x, y, Phaser.Math.Between(2, 3), color, 1).setDepth(depth);

    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0.3,
      duration: Phaser.Math.Between(380, 520),
      ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy()
    });
  }
}
