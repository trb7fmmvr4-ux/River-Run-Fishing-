import Phaser from 'phaser';
import { SCENE_KEYS, UI_THEME } from '../config/GameConfig';
import { TextButton } from '../ui/theme/TextButton';
import { ThemePanel } from '../ui/theme/ThemePanel';
import { UIAnchor } from '../ui/UIAnchor';
import { SettingsStore, type GameSettings } from '../systems/SettingsStore';

/**
 * Settings screen (audio / graphics / gameplay).
 *
 * Reads from and writes to the persistent SettingsStore (localStorage,
 * versioned). Audio settings are applied live to the Sound Manager so
 * changes are audible immediately; fullscreen toggles the Scale Manager.
 * The "gameplay" section is a labelled placeholder, ready for future
 * toggles — the layout is built from a small descriptor list so adding a
 * row later is a one-line change.
 *
 * Returns to whichever scene launched it (Menu by default; could be a
 * future in-game pause menu).
 */
export class SettingsScene extends Phaser.Scene {
  private settings!: GameSettings;
  private returnScene: string = SCENE_KEYS.MENU;

  constructor() {
    super(SCENE_KEYS.SETTINGS);
  }

  public init(data: { from?: string }): void {
    this.returnScene = data?.from ?? SCENE_KEYS.MENU;
  }

  public create(): void {
    this.settings = SettingsStore.load();
    this.cameras.main.setBackgroundColor('#0b0f14');

    const center = new UIAnchor(this).center();
    const cx = center.x;
    const cy = center.y;

    new ThemePanel(this, { x: cx, y: cy, width: 320, height: 220, title: 'SETTINGS' });

    let y = cy - 70;
    const labelX = cx - 134;
    const rowGap = 26;

    // --- Audio ---
    this.sectionHeading('AUDIO', labelX, y);
    y += 18;
    this.sliderRow('Master', labelX, y, this.settings.audio.master, (v) => {
      this.settings.audio.master = v;
      this.applyAndSave();
    });
    y += rowGap;
    this.sliderRow('Music', labelX, y, this.settings.audio.music, (v) => {
      this.settings.audio.music = v;
      this.applyAndSave();
    });
    y += rowGap;
    this.sliderRow('SFX', labelX, y, this.settings.audio.sfx, (v) => {
      this.settings.audio.sfx = v;
      this.applyAndSave();
    });
    y += rowGap + 4;

    // --- Graphics ---
    this.sectionHeading('GRAPHICS', labelX, y);
    y += 18;
    this.toggleRow('Fullscreen', labelX, y, this.settings.graphics.fullscreen, (on) => {
      this.settings.graphics.fullscreen = on;
      this.applyFullscreen(on);
      this.applyAndSave();
    });
    y += rowGap;

    // --- Gameplay (placeholder) ---
    this.sectionHeading('GAMEPLAY', labelX, y);
    y += 16;
    this.add
      .text(labelX, y, 'More options coming soon', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.small,
        color: UI_THEME.hex.slate
      })
      .setOrigin(0, 0.5)
      .setAlpha(0.7);

    // Back button. If this was launched from the in-game pause overlay
    // (not the main menu), stop just this scene — MainScene is still
    // running underneath (paused), so this reveals the pause overlay
    // exactly where the player left it. Restarting MainScene via
    // scene.start() here would re-run create() from scratch and lose
    // in-progress state, so that path is only used for the Menu case.
    new TextButton(this, {
      x: cx,
      y: cy + 92,
      width: 120,
      height: 26,
      label: 'Back',
      variant: 'ghost',
      onClick: () => {
        if (this.returnScene === 'PAUSE') {
          this.scene.stop();
        } else {
          this.scene.start(this.returnScene);
        }
      }
    });

    // Apply current audio on entry so the live state matches the saved one.
    this.applyAudio();
    this.cameras.main.fadeIn(250, 11, 15, 20);
  }

  // ---- Rows ----------------------------------------------------------------
  private sectionHeading(text: string, x: number, y: number): void {
    this.add.text(x, y, text, {
      fontFamily: UI_THEME.font.family,
      fontSize: UI_THEME.font.small,
      color: UI_THEME.hex.gold
    }).setOrigin(0, 0.5);
  }

  private sliderRow(label: string, x: number, y: number, value: number, onChange: (v: number) => void): void {
    this.add
      .text(x, y, label, { fontFamily: UI_THEME.font.family, fontSize: UI_THEME.font.body, color: UI_THEME.hex.white })
      .setOrigin(0, 0.5);

    const trackX = x + 96;
    const trackW = 150;
    const track = this.add.rectangle(trackX, y, trackW, 4, UI_THEME.color.panelEdge).setOrigin(0, 0.5);
    track.setStrokeStyle(1, UI_THEME.color.slate, 0.4);

    const fill = this.add.rectangle(trackX, y, trackW * value, 4, UI_THEME.color.gold).setOrigin(0, 0.5);

    const knob = this.add
      .circle(trackX + trackW * value, y, 6, UI_THEME.color.gold)
      .setStrokeStyle(2, UI_THEME.color.dark, 1)
      .setInteractive({ useHandCursor: true, draggable: true });

    const valueText = this.add
      .text(trackX + trackW + 10, y, `${Math.round(value * 100)}`, {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.small,
        color: UI_THEME.hex.muted
      })
      .setOrigin(0, 0.5);

    this.input.setDraggable(knob);

    const setFromX = (px: number) => {
      const clamped = Phaser.Math.Clamp(px, trackX, trackX + trackW);
      const v = (clamped - trackX) / trackW;
      knob.x = clamped;
      fill.width = trackW * v;
      valueText.setText(`${Math.round(v * 100)}`);
      onChange(v);
    };

    knob.on('drag', (_p: Phaser.Input.Pointer, dragX: number) => setFromX(dragX));

    // Allow clicking on the track to jump the value.
    track.setInteractive({ useHandCursor: true });
    track.on('pointerdown', (p: Phaser.Input.Pointer) => setFromX(p.x));
  }

  private toggleRow(label: string, x: number, y: number, value: boolean, onChange: (on: boolean) => void): void {
    this.add
      .text(x, y, label, { fontFamily: UI_THEME.font.family, fontSize: UI_THEME.font.body, color: UI_THEME.hex.white })
      .setOrigin(0, 0.5);

    const boxX = x + 96;
    const box = this.add
      .rectangle(boxX, y, 18, 18, UI_THEME.color.panel, 1)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, UI_THEME.color.gold)
      .setInteractive({ useHandCursor: true });

    const check = this.add
      .text(boxX + 9, y, value ? '✓' : '', { fontFamily: UI_THEME.font.family, fontSize: UI_THEME.font.body, color: UI_THEME.hex.mint })
      .setOrigin(0.5);

    let state = value;
    box.on('pointerdown', () => {
      state = !state;
      check.setText(state ? '✓' : '');
      onChange(state);
    });
  }

  // ---- Apply / persist -----------------------------------------------------
  private applyAndSave(): void {
    this.applyAudio();
    SettingsStore.save(this.settings);
  }

  private applyAudio(): void {
    // Master applies to the whole sound manager; music/sfx are stored for
    // per-channel use by sound code that reads SettingsStore.
    const sound = this.sound as Phaser.Sound.BaseSoundManager & { volume?: number };
    if (typeof sound.volume === 'number') {
      sound.volume = this.settings.audio.master;
    } else if ('setVolume' in this.sound && typeof (this.sound as any).setVolume === 'function') {
      (this.sound as any).setVolume(this.settings.audio.master);
    }
  }

  private applyFullscreen(on: boolean): void {
    if (on && !this.scale.isFullscreen) {
      this.scale.startFullscreen();
    } else if (!on && this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    }
  }
}
