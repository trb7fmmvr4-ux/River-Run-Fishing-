import Phaser from 'phaser';
import { TextButton } from './TextButton';
import { sharedUiSound } from '../../utils/PlaceholderSound';

/**
 * Keyboard navigation for a vertical list of TextButtons.
 *
 * Satisfies the UI framework's "keyboard navigation support" requirement:
 * Up/Down (and W/S) move a focus highlight between buttons, Enter/Space
 * activates the focused one, skipping disabled buttons. Mouse hover still
 * works independently — this just adds a keyboard path on top, so menus
 * are fully playable without a pointer.
 *
 * Reusable across any themed screen (menu, settings, save/load, and future
 * panels). Construct with the buttons in visual order; call `destroy()` on
 * scene shutdown.
 */
export class MenuNav {
  private readonly scene: Phaser.Scene;
  private readonly buttons: TextButton[];
  private index = -1;
  private handler?: (e: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene, buttons: TextButton[], startIndex = 0) {
    this.scene = scene;
    this.buttons = buttons;
    this.wire();
    this.focus(this.nextEnabled(startIndex, 1, true));
  }

  private wire(): void {
    this.handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
        case 's':
        case 'S':
          this.move(1);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.move(-1);
          break;
        case 'Enter':
        case ' ':
          if (this.index >= 0) this.buttons[this.index].activate();
          break;
        default:
          return;
      }
    };
    this.scene.input.keyboard?.on('keydown', this.handler);
  }

  private move(dir: 1 | -1): void {
    const next = this.nextEnabled(this.index + dir, dir);
    if (next !== -1) this.focus(next);
  }

  /** Find the next enabled button index in a direction, optionally inclusive. */
  private nextEnabled(from: number, dir: number, inclusive = false): number {
    const n = this.buttons.length;
    if (n === 0) return -1;
    let i = inclusive ? from : from;
    for (let step = 0; step < n; step++) {
      const idx = ((i % n) + n) % n;
      if (this.buttons[idx]?.isEnabled) return idx;
      i += dir || 1;
    }
    return -1;
  }

  private focus(idx: number): void {
    if (idx === -1 || idx === this.index) return;
    if (this.index >= 0) this.buttons[this.index]?.setFocused(false);
    this.index = idx;
    this.buttons[this.index]?.setFocused(true);
    sharedUiSound().playNavigate();
  }

  /**
   * Only ever called from the scene's SHUTDOWN handler (see MenuScene),
   * never while the menu is still visible. By the time SHUTDOWN fires,
   * Phaser has already begun tearing down the scene's GameObjects, so this
   * must NOT touch any button's visual state — doing so (it used to call
   * setFocused(false), which recolors a Text object) crashed deep inside
   * Phaser's own Text/texture internals once the label's underlying canvas
   * texture was already gone. There's also no visual reason to un-focus a
   * button on a scene that's disappearing anyway. Just release the
   * keyboard listener.
   */
  public destroy(): void {
    if (this.handler) this.scene.input.keyboard?.off('keydown', this.handler);
  }
}
