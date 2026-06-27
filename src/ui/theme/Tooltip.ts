import Phaser from 'phaser';
import { UI_THEME } from '../../config/GameConfig';
import { UIAnchor } from '../UIAnchor';

export interface TooltipOptions {
  /** Max width before the text wraps. */
  maxWidth?: number;
  /** Border accent; defaults to gold. */
  accent?: number;
  /** Depth; defaults high so it floats above panels. */
  depth?: number;
}

/**
 * A single reusable tooltip for a scene.
 *
 * One Tooltip instance is created per scene/screen and reused for every
 * hoverable element via `attach(target, text)` — cheaper than spawning a
 * bubble per element, and it guarantees only one tooltip shows at a time.
 * Styling comes entirely from UI_THEME so it matches panels/buttons, and
 * it clamps itself to stay on-screen (never renders partially off the
 * viewport).
 *
 * Positioned via UIAnchor: `pointer.x/y` are screen-space coordinates, and
 * this project's zoomed/scrolled MainScene camera means screen-space
 * coordinates are NOT world coordinates — setting them directly (as an
 * earlier version of this file did) is exactly the bug class that made
 * fixed UI render in the wrong place under zoom. Converting through
 * UIAnchor.toWorld() each time the tooltip moves is what makes this work
 * correctly in both the zoomed MainScene and the unzoomed menu scenes
 * (where the conversion is a no-op).
 */
export class Tooltip {
  private readonly anchor: UIAnchor;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly accent: number;
  private readonly maxWidth: number;
  private readonly padding = UI_THEME.spacing.sm;
  private lastViewportX = 0;
  private lastViewportY = 0;

  constructor(scene: Phaser.Scene, options: TooltipOptions = {}) {
    this.anchor = new UIAnchor(scene);
    this.accent = options.accent ?? UI_THEME.color.gold;
    this.maxWidth = options.maxWidth ?? 180;

    this.bg = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', {
      fontFamily: UI_THEME.font.family,
      fontSize: UI_THEME.font.small,
      color: UI_THEME.hex.white,
      wordWrap: { width: this.maxWidth },
      lineSpacing: 2
    });

    this.container = scene.add
      .container(0, 0, [this.bg, this.text])
      .setDepth(options.depth ?? 5000)
      .setVisible(false);
  }

  /** Wire a game object so hovering it shows `text` (string or per-hover supplier). */
  public attach(target: Phaser.GameObjects.GameObject & { on: Function }, text: string | (() => string)): void {
    target.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      this.show(typeof text === 'function' ? text() : text, pointer.x, pointer.y);
    });
    target.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.reposition(pointer.x, pointer.y);
    });
    target.on('pointerout', () => this.hide());
  }

  /** x/y are SCREEN-space (e.g. straight from a Phaser pointer), not world coordinates. */
  public show(text: string, x: number, y: number): void {
    this.text.setText(text);
    const w = Math.min(this.maxWidth, this.text.width) + this.padding * 2;
    const h = this.text.height + this.padding * 2;

    this.bg.clear();
    this.bg.fillStyle(UI_THEME.color.dark, 0.96);
    this.bg.fillRoundedRect(0, 0, w, h, 4);
    this.bg.lineStyle(1, this.accent, 0.9);
    this.bg.strokeRoundedRect(0, 0, w, h, 4);
    this.text.setPosition(this.padding, this.padding);

    this.container.setSize(w, h).setScale(this.anchor.inverseZoom).setVisible(true);
    this.reposition(x, y);
  }

  /** px/py are SCREEN-space pointer coordinates. */
  private reposition(px: number, py: number): void {
    this.lastViewportX = px;
    this.lastViewportY = py;
    const v = this.anchor.viewport;
    // Bubble size is in local (pre-scale) pixels; convert to viewport
    // pixels by the same inverse-zoom factor the container is scaled by,
    // so the clamping below compares like units to the live viewport.
    const w = this.container.width * this.anchor.inverseZoom;
    const h = this.container.height * this.anchor.inverseZoom;

    // Default: offset up-right of the cursor, then clamp to the viewport.
    let vx = px + 12;
    let vy = py - h - 8;
    if (vx + w > v.width - 4) vx = px - w - 12;
    if (vx < 4) vx = 4;
    if (vy < 4) vy = py + 16;
    if (vy + h > v.height - 4) vy = v.height - h - 4;

    const world = this.anchor.toWorld(vx, vy);
    this.container.setPosition(world.x, world.y);
  }

  /** Call once per frame while visible so this stays correctly placed if the camera scrolls mid-hover. */
  public update(): void {
    if (this.container.visible) {
      this.container.setScale(this.anchor.inverseZoom);
      this.reposition(this.lastViewportX, this.lastViewportY);
    }
  }

  public hide(): void {
    this.container.setVisible(false);
  }

  public destroy(): void {
    this.container.destroy();
  }
}
