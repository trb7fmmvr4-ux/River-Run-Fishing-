import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/GameConfig';
import { SettingsStore } from '../systems/SettingsStore';

/**
 * First scene to run. Responsible only for engine-level setup that needs
 * to happen before anything else loads. Intentionally does no asset
 * loading — that belongs to PreloadScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#0b0f14');

    // Apply persisted master volume immediately so audio honours the
    // player's saved setting from the very first sound. Per-channel
    // (music/sfx) values are read by sound code from SettingsStore.
    const settings = SettingsStore.load();
    if (typeof (this.sound as { volume?: number }).volume === 'number') {
      (this.sound as { volume: number }).volume = settings.audio.master;
    }

    this.scene.start(SCENE_KEYS.PRELOAD);
  }
}
