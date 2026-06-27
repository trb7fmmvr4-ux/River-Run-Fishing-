import Phaser from 'phaser';
import { UI_THEME } from '../../config/GameConfig';
import { sharedUiSound } from '../../utils/PlaceholderSound';

export interface TextButtonOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  /** Visual variant. 'primary' = gold, 'confirm' = mint, 'danger' = red, 'ghost' = subtle. */
  variant?: 'primary' | 'confirm' | 'danger' | 'ghost';
  onClick: () => void;
  /** Optional: disabled buttons render dimmed and ignore clicks. */
  enabled?: boolean;
}

/**
 * A reusable, themed, clickable button for the menu/settings/save UIs.
 *
 * Built entirely against UI_THEME so every button in the game looks the
 * same and future screens get consistent styling for free. It uses screen
 * space directly (these live in non-zoomed UI scenes like the Main Menu),
 * so there's no camera-anchor math — unlike the in-world HUD which has to
 * counter-scale. Container-based so callers can position/tween it as one
 * unit.
 */
export class TextButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly variant: NonNullable<TextButtonOptions['variant']>;
  private enabledState: boolean;
  private readonly onClick: () => void;

  constructor(scene: Phaser.Scene, options: TextButtonOptions) {
    super(scene, options.x, options.y);

    this.variant = options.variant ?? 'primary';
    this.enabledState = options.enabled ?? true;
    this.onClick = options.onClick;

    const w = options.width ?? 200;
    const h = options.height ?? 34;

    this.bg = scene.add
      .rectangle(0, 0, w, h, UI_THEME.color.panel, UI_THEME.panel.fillAlpha)
      .setStrokeStyle(UI_THEME.panel.borderWidth, this.edgeColor());

    this.label = scene.add
      .text(0, 0, options.label, {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.heading,
        color: UI_THEME.hex.white
      })
      .setOrigin(0.5);

    this.add([this.bg, this.label]);
    this.setSize(w, h);
    scene.add.existing(this);

    this.applyEnabledStyle();
    this.wireInteractions();
  }

  private accentColor(): number {
    switch (this.variant) {
      case 'confirm':
        return UI_THEME.color.mint;
      case 'danger':
        return UI_THEME.color.red;
      case 'ghost':
        return UI_THEME.color.slate;
      default:
        return UI_THEME.color.gold;
    }
  }

  private edgeColor(): number {
    return this.variant === 'ghost' ? UI_THEME.color.panelEdge : this.accentColor();
  }

  private wireInteractions(): void {
    this.bg.setInteractive({ useHandCursor: true });

    this.bg.on('pointerover', () => {
      if (!this.enabledState) return;
      this.bg.setFillStyle(this.accentColor(), 0.22);
      this.label.setColor(this.accentHex());
      sharedUiSound().playHover();
    });
    this.bg.on('pointerout', () => {
      if (!this.enabledState) return;
      this.bg.setFillStyle(UI_THEME.color.panel, UI_THEME.panel.fillAlpha);
      this.label.setColor(UI_THEME.hex.white);
    });
    this.bg.on('pointerdown', () => {
      if (!this.enabledState) return;
      this.scene.tweens.add({ targets: this, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true });
      sharedUiSound().playConfirm();
    });
    this.bg.on('pointerup', () => {
      if (!this.enabledState) return;
      this.onClick();
    });
  }

  private accentHex(): string {
    switch (this.variant) {
      case 'confirm':
        return UI_THEME.hex.mint;
      case 'danger':
        return UI_THEME.hex.red;
      case 'ghost':
        return UI_THEME.hex.slate;
      default:
        return UI_THEME.hex.gold;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabledState = enabled;
    this.applyEnabledStyle();
  }

  /**
   * Visually mark this button as keyboard-focused (mirrors the hover look)
   * or clear it. Additive — pointer interactions are unchanged; this just
   * lets a keyboard navigator share the same highlight styling.
   */
  public setFocused(focused: boolean): void {
    if (!this.enabledState) return;
    if (focused) {
      this.bg.setFillStyle(this.accentColor(), 0.22);
      this.label.setColor(this.accentHex());
    } else {
      this.bg.setFillStyle(UI_THEME.color.panel, UI_THEME.panel.fillAlpha);
      this.label.setColor(UI_THEME.hex.white);
    }
  }

  /** Programmatically trigger the click (used by keyboard Enter/Space). */
  public activate(): void {
    if (!this.enabledState) return;
    this.scene.tweens.add({ targets: this, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true });
    this.onClick();
  }

  /** Whether this button currently accepts input (for nav skip-over). */
  public get isEnabled(): boolean {
    return this.enabledState;
  }

  private applyEnabledStyle(): void {
    if (this.enabledState) {
      this.setAlpha(1);
      this.bg.setStrokeStyle(UI_THEME.panel.borderWidth, this.edgeColor());
      this.label.setColor(UI_THEME.hex.white);
    } else {
      this.setAlpha(0.45);
      this.bg.setStrokeStyle(UI_THEME.panel.borderWidth, UI_THEME.color.panelEdge);
      this.label.setColor(UI_THEME.hex.slate);
    }
  }
}
