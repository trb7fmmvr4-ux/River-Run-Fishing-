import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/GameConfig';
import { generatePlaceholderTextures } from '../utils/PlaceholderTextures';
import { ArtRegistry } from '../utils/AssetRegistry';

const BAR_WIDTH = 160;
const BAR_HEIGHT = 14;

/**
 * Loads everything MainScene needs.
 *
 * The loading bar is wired up against the real Phaser LoaderPlugin
 * `progress` event. The art packs are queued here through the centralized
 * ArtRegistry; the bar reflects their real load progress. Procedural
 * placeholder textures are still generated as a fallback, then the registry
 * binds the real art over the placeholder keys (see AssetRegistry).
 */
export class PreloadScene extends Phaser.Scene {
  private progressBar?: Phaser.GameObjects.Graphics;
  private progressBox?: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENE_KEYS.PRELOAD);
  }

  public preload(): void {
    this.drawLoadingUI();
    this.load.on('progress', (value: number) => this.drawProgress(value));

    // Queue every art pack (manifests + sheets) through the single pipeline.
    ArtRegistry.queueAll(this);
  }

  public create(): void {
    // Generate procedural placeholders first so they exist as a fallback...
    generatePlaceholderTextures(this);

    // ...then register all real art and bind it over the placeholder keys.
    // If any pack's files are missing, the placeholders simply remain.
    ArtRegistry.registerAll(this);

    this.progressBar?.destroy();
    this.progressBox?.destroy();

    this.scene.start(SCENE_KEYS.MENU);
  }

  private drawLoadingUI(): void {
    const x = GAME_WIDTH / 2 - BAR_WIDTH / 2;
    const y = GAME_HEIGHT / 2 - BAR_HEIGHT / 2;

    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0xffffff, 0.12);
    this.progressBox.fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);

    this.progressBar = this.add.graphics();
    this.drawProgress(0);
  }

  private drawProgress(value: number): void {
    if (!this.progressBar) return;

    const x = GAME_WIDTH / 2 - BAR_WIDTH / 2;
    const y = GAME_HEIGHT / 2 - BAR_HEIGHT / 2;

    this.progressBar.clear();
    this.progressBar.fillStyle(0xf4c170, 1);
    this.progressBar.fillRect(x + 2, y + 2, (BAR_WIDTH - 4) * value, BAR_HEIGHT - 4);
  }
}
