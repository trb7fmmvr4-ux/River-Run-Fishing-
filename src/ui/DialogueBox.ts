import Phaser from 'phaser';
import { UI_THEME } from '../config/GameConfig';
import { edge, fitSize } from './ScreenLayout';

export interface DialogueLine {
  speaker?: string;
  text: string;
}

/**
 * A reusable dialogue box (speaker name + text, advanced by click / Space /
 * Enter), anchored to the bottom of the screen.
 *
 * Built for the beach intro and NPC conversations, in the same themed
 * style as the rest of the UI. It runs a short typewriter reveal; the
 * first advance press completes the reveal, the next advances the line.
 * On the final line it calls `onComplete`. Self-contained and
 * self-cleaning — create it, call `start(lines)`, done.
 *
 * Lives in HUDScene — positioned once, at construction, at a fixed
 * screen coordinate. No per-frame anchoring needed: HUDScene's camera
 * never zooms or scrolls, so there's nothing for this to track.
 */
export class DialogueBox {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;

  private lines: DialogueLine[] = [];
  private index = 0;
  private fullText = '';
  private revealed = 0;
  private revealing = false;
  private revealEvent?: Phaser.Time.TimerEvent;
  private onComplete?: () => void;
  private advanceHandler?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const margin = UI_THEME.spacing.md;
    const boxH = 64;
    const fit = fitSize(480 - margin * 2, boxH);
    const boxW = fit.width;

    const bg = scene.add.graphics();
    bg.fillStyle(UI_THEME.color.dark, 0.62);
    bg.fillRoundedRect(-boxW / 2 - 2, -boxH / 2 - 2, boxW + 4, boxH + 4, UI_THEME.panel.radius);
    bg.fillStyle(UI_THEME.color.panel, 0.96);
    bg.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, UI_THEME.panel.radius);
    bg.lineStyle(UI_THEME.panel.borderWidth, UI_THEME.color.gold, 1);
    bg.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, UI_THEME.panel.radius);

    this.nameText = scene.add.text(-boxW / 2 + 10, -boxH / 2 + 6, '', {
      fontFamily: UI_THEME.font.family,
      fontSize: UI_THEME.font.small,
      color: UI_THEME.hex.gold
    });

    this.bodyText = scene.add.text(-boxW / 2 + 10, -boxH / 2 + 22, '', {
      fontFamily: UI_THEME.font.family,
      fontSize: UI_THEME.font.body,
      color: UI_THEME.hex.white,
      wordWrap: { width: boxW - 20 },
      lineSpacing: 3
    });

    this.hint = scene.add
      .text(boxW / 2 - 10, boxH / 2 - 6, '▼', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.small,
        color: UI_THEME.hex.muted
      })
      .setOrigin(1, 1);
    scene.tweens.add({ targets: this.hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const pos = edge('bottom', 0, margin + boxH / 2);
    this.container = scene.add
      .container(pos.x, pos.y, [bg, this.nameText, this.bodyText, this.hint])
      .setDepth(7000)
      .setVisible(false);
  }

  public get isActive(): boolean {
    return this.container.visible;
  }

  public start(lines: DialogueLine[], onComplete?: () => void): void {
    this.lines = lines;
    this.onComplete = onComplete;
    this.index = 0;
    this.container.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 160 });

    // Advance on pointer or Space/Enter.
    this.advanceHandler = () => this.advance();
    this.scene.input.on('pointerdown', this.advanceHandler);
    this.scene.input.keyboard?.on('keydown-SPACE', this.advanceHandler);
    this.scene.input.keyboard?.on('keydown-ENTER', this.advanceHandler);

    this.showLine();
  }

  private showLine(): void {
    const line = this.lines[this.index];
    this.nameText.setText(line.speaker ?? '');
    this.fullText = line.text;
    this.revealed = 0;
    this.revealing = true;
    this.bodyText.setText('');

    this.revealEvent?.remove();
    this.revealEvent = this.scene.time.addEvent({
      delay: 18,
      loop: true,
      callback: () => {
        this.revealed++;
        this.bodyText.setText(this.fullText.slice(0, this.revealed));
        if (this.revealed >= this.fullText.length) {
          this.revealing = false;
          this.revealEvent?.remove();
        }
      }
    });
  }

  private advance(): void {
    if (!this.isActive) return;

    // First press completes the reveal instead of skipping the line.
    if (this.revealing) {
      this.revealEvent?.remove();
      this.bodyText.setText(this.fullText);
      this.revealing = false;
      return;
    }

    this.index++;
    if (this.index >= this.lines.length) {
      this.finish();
    } else {
      this.showLine();
    }
  }

  private finish(): void {
    this.cleanupInput();
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        this.container.setVisible(false);
        this.onComplete?.();
      }
    });
  }

  private cleanupInput(): void {
    if (!this.advanceHandler) return;
    this.scene.input.off('pointerdown', this.advanceHandler);
    this.scene.input.keyboard?.off('keydown-SPACE', this.advanceHandler);
    this.scene.input.keyboard?.off('keydown-ENTER', this.advanceHandler);
    this.advanceHandler = undefined;
  }

  public destroy(): void {
    this.cleanupInput();
    this.revealEvent?.remove();
    this.container.destroy();
  }
}
