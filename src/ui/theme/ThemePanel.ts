import Phaser from 'phaser';
import { UI_THEME } from '../../config/GameConfig';

export interface ThemePanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Border accent colour; defaults to gold. */
  accent?: number;
  /** Optional heading drawn at the top of the panel. */
  title?: string;
}

/**
 * A reusable, themed panel background (rounded rect, dark fill, accent
 * border) with an optional title — the canonical "clean panel" look from
 * the style guide.
 *
 * Used by the menu/settings/save screens. Existing in-world panels
 * (Inventory/Shop) are intentionally left as-is; this is the component
 * future panels (journal, crafting, combat) should be built from so they
 * all match. Container-based for easy positioning.
 */
export class ThemePanel extends Phaser.GameObjects.Container {
  public readonly contentWidth: number;
  public readonly contentHeight: number;

  constructor(scene: Phaser.Scene, options: ThemePanelOptions) {
    super(scene, options.x, options.y);

    const w = options.width;
    const h = options.height;
    const accent = options.accent ?? UI_THEME.color.gold;

    this.contentWidth = w;
    this.contentHeight = h;

    const g = scene.add.graphics();
    // drop shadow
    g.fillStyle(UI_THEME.color.dark, 0.5);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, UI_THEME.panel.radius);
    // panel fill
    g.fillStyle(UI_THEME.color.panel, UI_THEME.panel.fillAlpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, UI_THEME.panel.radius);
    // border
    g.lineStyle(UI_THEME.panel.borderWidth, accent, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, UI_THEME.panel.radius);
    // subtle inner top highlight
    g.lineStyle(1, accent, 0.18);
    g.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, UI_THEME.panel.radius);

    this.add(g);

    if (options.title) {
      const title = scene.add
        .text(0, -h / 2 + UI_THEME.spacing.md, options.title, {
          fontFamily: UI_THEME.font.family,
          fontSize: UI_THEME.font.heading,
          color: UI_THEME.hex.gold
        })
        .setOrigin(0.5);
      this.add(title);

      // underline rule beneath the title
      const rule = scene.add.graphics();
      rule.lineStyle(1, accent, 0.4);
      rule.lineBetween(-w / 2 + UI_THEME.spacing.lg, -h / 2 + UI_THEME.spacing.lg + 8, w / 2 - UI_THEME.spacing.lg, -h / 2 + UI_THEME.spacing.lg + 8);
      this.add(rule);
    }

    scene.add.existing(this);
  }
}
