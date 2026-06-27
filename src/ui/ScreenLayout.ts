import { GAME_HEIGHT, GAME_WIDTH } from '../config/GameConfig';

export type ScreenEdge =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/**
 * Fixed-screen positioning for HUDScene.
 *
 * This is deliberately NOT a camera-aware class like the old
 * UIAnchor/UILayout — it doesn't need to be. HUDScene's camera is never
 * zoomed and never scrolled (nothing in that scene ever calls setZoom or
 * startFollow), so a fixed point on the design resolution IS the
 * screen position, permanently, with no per-frame recomputation needed.
 *
 * This is the entire point of splitting UI into its own scene: the old
 * architecture's per-frame "compute the world position that will render
 * at the right screen position" math was correct (verified repeatedly),
 * but it was also the single largest source of risk in the project —
 * every panel had to get that conversion right, every frame, forever.
 * Removing the need for the conversion removes the risk category
 * entirely, not just the symptom.
 */
export function center(offsetX = 0, offsetY = 0): { x: number; y: number } {
  return { x: GAME_WIDTH / 2 + offsetX, y: GAME_HEIGHT / 2 + offsetY };
}

export function edge(point: ScreenEdge, marginX = 0, marginY = 0): { x: number; y: number } {
  const x = { left: marginX, right: GAME_WIDTH - marginX, center: GAME_WIDTH / 2 }[
    point.includes('left') ? 'left' : point.includes('right') ? 'right' : 'center'
  ];
  const y = { top: marginY, bottom: GAME_HEIGHT - marginY, center: GAME_HEIGHT / 2 }[
    point.includes('top') ? 'top' : point.includes('bottom') ? 'bottom' : 'center'
  ];
  return { x, y };
}

/** Clamp a desired panel size so it can never exceed the design resolution. Panels should shrink to fit, never overflow. */
export function fitSize(desiredWidth: number, desiredHeight: number, margin = 8): { width: number; height: number } {
  return {
    width: Math.min(desiredWidth, GAME_WIDTH - margin * 2),
    height: Math.min(desiredHeight, GAME_HEIGHT - margin * 2)
  };
}

export const SCREEN_WIDTH = GAME_WIDTH;
export const SCREEN_HEIGHT = GAME_HEIGHT;
