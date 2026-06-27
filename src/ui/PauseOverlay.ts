import Phaser from 'phaser';
import { DEPTH, SCENE_KEYS } from '../config/GameConfig';
import { center, fitSize } from './ScreenLayout';
import { ThemePanel } from './theme/ThemePanel';
import { TextButton } from './theme/TextButton';

export interface PauseOverlayCallbacks {
  onResume: () => void;
  onQuitToMenu: () => void;
}

/**
 * A real in-game pause menu — Resume / Settings / Quit to Menu — replacing
 * the previous "Esc instantly exits to the title screen" behaviour.
 *
 * Lives in HUDScene, running alongside MainScene, so the world stays
 * visible (dimmed) behind it and there's no scene teardown/rebuild
 * involved in opening or closing it.
 *
 * Settings is opened via `scene.launch()` on top of both MainScene and
 * HUDScene (gameplay is already frozen by MainScene's own pause flag, not
 * by Phaser's scene pause), so returning from Settings reveals this same
 * pause overlay exactly where the player left it. See MainScene's Esc
 * handler and SettingsScene's Back button for the other half of this.
 *
 * Positioned once at construction, at a fixed screen coordinate — no
 * per-frame anchoring needed, since HUDScene's camera never moves.
 */
export class PauseOverlay {
  private readonly scene: Phaser.Scene;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly panel: ThemePanel;
  private readonly resumeButton: TextButton;
  private readonly settingsButton: TextButton;
  private readonly quitButton: TextButton;
  private open = false;

  constructor(scene: Phaser.Scene, callbacks: PauseOverlayCallbacks) {
    this.scene = scene;

    const fit = fitSize(220, 160);

    // A full-screen dim behind the panel — sized generously past the
    // design resolution so it always fully covers, then clamped the same
    // way every other panel is.
    const dimSize = fitSize(2000, 2000);
    const c = center();
    this.backdrop = scene.add
      .rectangle(c.x, c.y, dimSize.width, dimSize.height, 0x000000, 0.55)
      .setDepth(DEPTH.PANEL - 1)
      .setVisible(false)
      .setInteractive(); // swallow clicks so the world behind can't be clicked through

    this.panel = new ThemePanel(scene, { x: c.x, y: c.y, width: fit.width, height: fit.height, title: 'PAUSED' });
    this.panel.setDepth(DEPTH.PANEL).setVisible(false);

    const buttonWidth = fit.width - 48;
    const resumePos = center(0, -28);
    this.resumeButton = new TextButton(scene, {
      x: resumePos.x,
      y: resumePos.y,
      label: 'Resume',
      width: buttonWidth,
      onClick: () => callbacks.onResume()
    });
    const settingsPos = center(0, 14);
    this.settingsButton = new TextButton(scene, {
      x: settingsPos.x,
      y: settingsPos.y,
      label: 'Settings',
      width: buttonWidth,
      onClick: () => this.openSettings()
    });
    const quitPos = center(0, 56);
    this.quitButton = new TextButton(scene, {
      x: quitPos.x,
      y: quitPos.y,
      label: 'Quit to Menu',
      width: buttonWidth,
      variant: 'danger',
      onClick: () => callbacks.onQuitToMenu()
    });
    for (const b of [this.resumeButton, this.settingsButton, this.quitButton]) {
      b.setDepth(DEPTH.PANEL + 1).setVisible(false);
    }
  }

  private openSettings(): void {
    // MainScene keeps running (its own isPaused flag already froze
    // gameplay before this overlay could be shown — see MainScene's Esc
    // handler), so this just launches Settings on top with no Phaser-level
    // scene pause involved. 'PAUSE' is a sentinel, not a real scene key —
    // SettingsScene's Back button checks for it to know to stop itself
    // and reveal the paused game underneath, rather than scene.start()-ing
    // back to the main menu.
    this.scene.scene.launch(SCENE_KEYS.SETTINGS, { from: 'PAUSE' });
  }

  public get isOpen(): boolean {
    return this.open;
  }

  public show(): void {
    this.open = true;
    this.setVisible(true);
  }

  public hide(): void {
    this.open = false;
    this.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    this.backdrop.setVisible(visible);
    this.panel.setVisible(visible);
    this.resumeButton.setVisible(visible);
    this.settingsButton.setVisible(visible);
    this.quitButton.setVisible(visible);
  }

  public destroy(): void {
    this.backdrop.destroy();
    this.panel.destroy();
    this.resumeButton.destroy();
    this.settingsButton.destroy();
    this.quitButton.destroy();
  }
}
