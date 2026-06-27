import Phaser from 'phaser';

/**
 * Shared tween shapes for small UI feedback gestures — extracted only
 * because each one had at least two independent, real call sites doing
 * the same thing with slightly different inline tween configs (GoldHUD's
 * coin pulse and QuestHUD's pop; QuestHUD's show-in and PlayerHealthHUD's
 * gained-pip pop). Not a general animation framework — there are
 * deliberately only two functions here. If a third genuinely distinct
 * shape emerges later (the project already has one candidate: a
 * fade-then-hide, currently only used once in QuestHUD.hide()), add it
 * then, with its own second real caller, rather than guessing now.
 */

export interface PopPulseOptions {
  scale?: number;
  duration?: number;
  ease?: string;
}

/** A quick scale-up-and-back pulse to draw the eye to something that just changed, without it disappearing or moving. */
export function popPulse(
  scene: Phaser.Scene,
  targets: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[],
  options: PopPulseOptions = {}
): void {
  scene.tweens.add({
    targets,
    scale: options.scale ?? 1.3,
    duration: options.duration ?? 110,
    yoyo: true,
    ease: options.ease ?? 'Quad.easeOut'
  });
}

export interface PopInOptions {
  fromScale?: number;
  withAlpha?: boolean;
  duration?: number;
  ease?: string;
}

/** Scale (and optionally fade) in from below full size to 1 — for something appearing for the first time or being newly emphasized. */
export function popIn(
  scene: Phaser.Scene,
  targets: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[],
  options: PopInOptions = {}
): void {
  const list = Array.isArray(targets) ? targets : [targets];
  const fromScale = options.fromScale ?? 0.4;
  const withAlpha = options.withAlpha ?? false;

  for (const t of list) {
    (t as unknown as { setScale: (s: number) => void }).setScale(fromScale);
    if (withAlpha) (t as unknown as { setAlpha: (a: number) => void }).setAlpha(0);
  }

  scene.tweens.add({
    targets: list,
    scale: 1,
    ...(withAlpha ? { alpha: 1 } : {}),
    duration: options.duration ?? 220,
    ease: options.ease ?? 'Back.easeOut'
  });
}
