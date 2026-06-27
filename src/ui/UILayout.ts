import Phaser from 'phaser';
import { UIAnchor, type AnchorPoint } from './UIAnchor';

type PlaceableTarget = {
  setPosition: (x: number, y: number) => unknown;
  setScale?: (s: number) => unknown;
};

interface LayoutEntry {
  target: PlaceableTarget;
  origin: AnchorPoint;
  marginX: number;
  marginY: number;
  offsetX: number;
  offsetY: number;
  compensateZoom: boolean;
}

/**
 * UILayout — register a panel's elements once, then call `update()` every
 * frame (or once on open) to keep all of them anchored to the viewport.
 *
 * This is the piece that actually removes duplicated positioning code:
 * before this, every panel wrote its own `reposition()` method with one
 * `screenToWorld`-style call per element. With UILayout, a panel's
 * constructor just *registers* each element against a viewport anchor
 * point once, and `update()` repositions everything in one call — no
 * panel author writes positioning math again. New UI panels automatically
 * inherit centered-by-default, viewport-derived, zoom-correct placement
 * just by using this class.
 *
 * Usage:
 * ```ts
 * this.layout = new UILayout(scene);
 * this.layout.addCentered(this.background, 0, 0);
 * this.layout.addCentered(this.title, 0, -panelHeight / 2 + 12);
 * this.layout.addEdge(this.coinIcon, 'top-left', 10, 10);
 * // every frame (or right after toggling open):
 * this.layout.update();
 * ```
 */
export class UILayout {
  private readonly anchor: UIAnchor;
  private readonly entries: LayoutEntry[] = [];

  constructor(sceneOrCamera: Phaser.Scene | Phaser.Cameras.Scene2D.Camera) {
    this.anchor = new UIAnchor(sceneOrCamera);
  }

  /** The live viewport size (always derived from the camera). */
  public get viewport() {
    return this.anchor.viewport;
  }

  /** Clamp a desired panel size so it can never exceed the viewport. */
  public fitSize(desiredWidth: number, desiredHeight: number, margin = 8) {
    return this.anchor.fitSize(desiredWidth, desiredHeight, margin);
  }

  /** Counter-scale for callers that need to combine it with their own additional scaling (e.g. a press-squash tween). */
  public get inverseZoom(): number {
    return this.anchor.inverseZoom;
  }

  /** Register an element positioned relative to the viewport's center — the common case for panel content. */
  public addCentered(target: PlaceableTarget, offsetX = 0, offsetY = 0, compensateZoom = true): void {
    this.entries.push({ target, origin: 'center', marginX: 0, marginY: 0, offsetX, offsetY, compensateZoom });
  }

  /** Register an element anchored to a named viewport edge/corner — for HUD elements that hug a side. */
  public addEdge(
    target: PlaceableTarget,
    origin: AnchorPoint,
    marginX = 0,
    marginY = 0,
    offsetX = 0,
    offsetY = 0,
    compensateZoom = true
  ): void {
    this.entries.push({ target, origin, marginX, marginY, offsetX, offsetY, compensateZoom });
  }

  /** Stop tracking an element (e.g. if it's destroyed independently of the panel). */
  public remove(target: PlaceableTarget): void {
    const idx = this.entries.findIndex((e) => e.target === target);
    if (idx !== -1) this.entries.splice(idx, 1);
  }

  /** Reposition every registered element to its current viewport anchor. Call each frame, or at minimum right after opening a panel. */
  public update(): void {
    for (const e of this.entries) {
      const base =
        e.origin === 'center' ? this.anchor.centerViewport() : this.anchor.edgeViewport(e.origin, e.marginX, e.marginY);
      const p = this.anchor.toWorld(base.x + e.offsetX, base.y + e.offsetY);
      e.target.setPosition(p.x, p.y);
      if (e.compensateZoom && e.target.setScale) e.target.setScale(this.anchor.inverseZoom);
    }
  }
}
