import Phaser from 'phaser';
import { DEPTH } from '../config/GameConfig';
import { edge } from '../ui/ScreenLayout';

/**
 * A minimal developer overlay — FPS, the current fishing state, and a
 * live entity count — toggled with the backtick key, off by default.
 *
 * Deliberately isolated from production gameplay: this reads state, it
 * never writes any (no spawn/teleport commands here, by design — those
 * would touch gameplay systems directly and belong in a dedicated
 * MainScene-side debug command set if/when that's actually needed, not
 * bundled into a screen-space readout). Lives in HUDScene like every
 * other screen-space element; MainScene pushes the data it owns (the
 * current fishing state, the active enemy count) in once per frame via
 * setFishingState() / setEntityCount() — cheap, and keeps this class from
 * needing a direct reference to FishingSystem or CombatSystem at all.
 */
export class DebugOverlay {
  private readonly scene: Phaser.Scene;
  private readonly text: Phaser.GameObjects.Text;
  private readonly toggleKey?: Phaser.Input.Keyboard.Key;
  private visible = false;
  private fishingState = 'idle';
  private entityCount = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const pos = edge('top-left', 4, 60);
    this.text = scene.add
      .text(pos.x, pos.y, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#8cffb0',
        backgroundColor: '#0b0f14'
      })
      .setOrigin(0, 0)
      .setDepth(DEPTH.HUD_GOLD + 50)
      .setVisible(false)
      .setAlpha(0.85);

    this.toggleKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
    this.toggleKey?.on('down', () => {
      this.visible = !this.visible;
      this.text.setVisible(this.visible);
    });
  }

  /** MainScene calls this once per frame with whatever it wants surfaced — currently just the fishing state. */
  public setFishingState(state: string): void {
    this.fishingState = state;
  }

  /** MainScene calls this once per frame with however many live, non-player entities (enemies, etc.) are active. */
  public setEntityCount(count: number): void {
    this.entityCount = count;
  }

  public update(): void {
    if (!this.visible) return;
    const fps = Math.round(this.scene.game.loop.actualFps);
    this.text.setText(`FPS: ${fps}\nFishing: ${this.fishingState}\nEntities: ${this.entityCount}\n[\`] toggle`);
  }

  public destroy(): void {
    this.toggleKey?.removeAllListeners();
    this.text.destroy();
  }
}
