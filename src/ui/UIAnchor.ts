import Phaser from 'phaser';

export type AnchorPoint =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * UIAnchor — the single source of truth for converting a fixed point on
 * the visible game VIEWPORT into the world-space coordinate that renders
 * there right now, for a given camera.
 *
 * Why this exists: this project renders UI in world space (not via
 * `setScrollFactor(0)`, which is a long-documented Phaser quirk — under a
 * zoomed camera, scrollFactor(0) objects can render at the wrong position,
 * the wrong size, or not at all). Positioning UI at the world coordinate
 * that *currently* projects onto a fixed viewport point sidesteps that
 * entirely, reusing the same transform every ordinary GameObject already
 * relies on.
 *
 * Every size used here comes from the CAMERA itself (`camera.width`,
 * `camera.height`, `camera.zoom`), never from a hardcoded config constant.
 * For scenes that never zoom or scroll their camera (Menu, Settings,
 * Credits — every scene except MainScene), zoom is 1 and scroll is
 * (0,0) by default, so this collapses to an identity transform: viewport
 * coordinates ARE world coordinates there. That means the exact same
 * class is correct in both contexts with no special-casing required by
 * callers — the one thing that made hand-rolled per-panel math fragile
 * before.
 */
export class UIAnchor {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  constructor(sceneOrCamera: Phaser.Scene | Phaser.Cameras.Scene2D.Camera) {
    this.camera =
      'cameras' in sceneOrCamera ? sceneOrCamera.cameras.main : sceneOrCamera;
  }

  /** The live viewport size, in viewport pixels — always derived from the camera, never a constant. */
  public get viewport(): ViewportSize {
    return { width: this.camera.width, height: this.camera.height };
  }

  /** Counter-scale so a fixed-size element renders at a constant on-screen size under any zoom. */
  public get inverseZoom(): number {
    return 1 / this.camera.zoom;
  }

  /** Convert a fixed viewport-space point into the world-space point that currently renders there. */
  public toWorld(viewportX: number, viewportY: number): { x: number; y: number } {
    return {
      x: this.camera.scrollX + viewportX / this.camera.zoom,
      y: this.camera.scrollY + viewportY / this.camera.zoom
    };
  }

  /** The viewport's center point, in viewport pixels (not yet converted to world space). */
  public centerViewport(): { x: number; y: number } {
    const v = this.viewport;
    return { x: v.width / 2, y: v.height / 2 };
  }

  /** A named edge/corner of the viewport, in viewport pixels (not yet converted to world space). */
  public edgeViewport(point: AnchorPoint, marginX = 0, marginY = 0): { x: number; y: number } {
    const v = this.viewport;
    const x = { left: marginX, right: v.width - marginX, center: v.width / 2 }[
      point.includes('left') ? 'left' : point.includes('right') ? 'right' : 'center'
    ];
    const y = { top: marginY, bottom: v.height - marginY, center: v.height / 2 }[
      point.includes('top') ? 'top' : point.includes('bottom') ? 'bottom' : 'center'
    ];
    return { x, y };
  }

  /** The viewport's center, with an optional offset in viewport pixels — the common case for panels. */
  public center(offsetX = 0, offsetY = 0): { x: number; y: number } {
    const c = this.centerViewport();
    return this.toWorld(c.x + offsetX, c.y + offsetY);
  }

  /**
   * A named edge/corner of the viewport, inset by a margin in viewport
   * pixels — for HUD elements that hug a side rather than sitting at
   * center (the action button, the joystick, corner HUD readouts).
   */
  public edge(point: AnchorPoint, marginX = 0, marginY = 0): { x: number; y: number } {
    const e = this.edgeViewport(point, marginX, marginY);
    return this.toWorld(e.x, e.y);
  }

  /**
   * Clamp a desired panel size so it can never exceed the viewport (minus
   * a safety margin on each side). Use this instead of a fixed pixel
   * constant for panel width/height — a panel that would overflow should
   * shrink to fit, not spill off-screen. Returns the same size unchanged
   * if it already fits.
   */
  public fitSize(desiredWidth: number, desiredHeight: number, margin = 8): ViewportSize {
    const v = this.viewport;
    return {
      width: Math.min(desiredWidth, v.width - margin * 2),
      height: Math.min(desiredHeight, v.height - margin * 2)
    };
  }

  /** Apply a viewport position (and, by default, zoom-compensating scale) to a GameObject in one call. */
  public place(
    target: { setPosition: (x: number, y: number) => unknown; setScale?: (s: number) => unknown },
    viewportX: number,
    viewportY: number,
    compensateZoom = true
  ): void {
    const p = this.toWorld(viewportX, viewportY);
    target.setPosition(p.x, p.y);
    if (compensateZoom && target.setScale) target.setScale(this.inverseZoom);
  }
}
