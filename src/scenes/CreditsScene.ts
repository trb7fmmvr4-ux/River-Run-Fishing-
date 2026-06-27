import Phaser from 'phaser';
import { SCENE_KEYS, UI_THEME } from '../config/GameConfig';
import { TextButton } from '../ui/theme/TextButton';
import { ThemePanel } from '../ui/theme/ThemePanel';
import { UIAnchor } from '../ui/UIAnchor';

/**
 * Credits screen. Intentionally simple and easy to extend — the credit
 * lines are a data list, so adding entries later is trivial.
 */
export class CreditsScene extends Phaser.Scene {
  private returnScene: string = SCENE_KEYS.MENU;

  constructor() {
    super(SCENE_KEYS.CREDITS);
  }

  public init(data: { from?: string }): void {
    this.returnScene = data?.from ?? SCENE_KEYS.MENU;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#0b0f14');
    const center = new UIAnchor(this).center();
    const cx = center.x;
    const cy = center.y;

    new ThemePanel(this, { x: cx, y: cy, width: 300, height: 200, title: 'CREDITS' });

    const lines: [string, string][] = [
      ['Design & Code', 'River Run Team'],
      ['Art Direction', 'Cinematic Pixel Art'],
      ['Engine', 'Phaser 3 + TypeScript'],
      ['Built with', 'Vite']
    ];

    let y = cy - 52;
    for (const [role, name] of lines) {
      this.add
        .text(cx, y, role, { fontFamily: UI_THEME.font.family, fontSize: UI_THEME.font.small, color: UI_THEME.hex.gold })
        .setOrigin(0.5);
      this.add
        .text(cx, y + 13, name, { fontFamily: UI_THEME.font.family, fontSize: UI_THEME.font.body, color: UI_THEME.hex.white })
        .setOrigin(0.5);
      y += 34;
    }

    this.add
      .text(cx, cy + 64, 'Thank you for playing.', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.small,
        color: UI_THEME.hex.slate
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    new TextButton(this, {
      x: cx,
      y: cy + 86,
      width: 120,
      height: 26,
      label: 'Back',
      variant: 'ghost',
      onClick: () => this.scene.start(this.returnScene)
    });

    this.cameras.main.fadeIn(250, 11, 15, 20);
  }
}
