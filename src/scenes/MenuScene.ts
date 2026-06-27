import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS, UI_THEME } from '../config/GameConfig';
import { TextButton } from '../ui/theme/TextButton';
import { MenuNav } from '../ui/theme/MenuNav';
import { ArtRegistry } from '../utils/AssetRegistry';
import { UIAnchor } from '../ui/UIAnchor';
import { SaveSystem } from '../systems/SaveSystem';

/**
 * The Main Menu — the game's front door.
 *
 * Presents a cinematic animated pixel-art backdrop (layered water +
 * drifting ambient motes built from the real art packs, with a graceful
 * solid-colour fallback) and the primary navigation. It owns no gameplay
 * state; it only routes to other scenes. Runs at native resolution (no
 * camera zoom) so UI math is plain screen space.
 *
 * Flow: Boot → Preload (loads art) → Menu → MainScene (Play/Continue).
 */
export class MenuScene extends Phaser.Scene {
  private waterStrips: Phaser.GameObjects.TileSprite[] = [];
  private motes: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super(SCENE_KEYS.MENU);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#0b0f14');

    this.buildBackground();
    this.buildTitle();
    this.buildButtons();

    this.cameras.main.fadeIn(450, 11, 15, 20);
  }

  // ---- Background -----------------------------------------------------------
  private buildBackground(): void {
    // Sky gradient band (top) using layered translucent rectangles.
    const skyTop = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, GAME_WIDTH, GAME_HEIGHT * 0.56, 0x1b2b3a).setDepth(0);
    skyTop.setAlpha(0.9);
    const horizon = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.55, GAME_WIDTH, 2, 0x3a5a6e).setDepth(1);
    horizon.setAlpha(0.6);

    // Animated water across the lower portion, tiled from the real water
    // art (extracted to standalone tileable textures by the registry).
    const waterKeys: string[] = [];
    for (let f = 0; f < 4; f++) {
      const key = ArtRegistry.waterTile('lake', f);
      if (this.textures.exists(key)) waterKeys.push(key);
    }

    if (waterKeys.length > 0) {
      const bandTop = Math.floor(GAME_HEIGHT * 0.56);
      const bandHeight = GAME_HEIGHT - bandTop;
      const strip = this.add
        .tileSprite(0, bandTop, GAME_WIDTH, bandHeight, waterKeys[0])
        .setOrigin(0, 0)
        .setDepth(2);
      strip.setTileScale(2, 2); // chunkier pixels for a cinematic feel
      this.waterStrips.push(strip);

      // Frame-cycle for shimmer + slow horizontal drift.
      let frame = 0;
      this.time.addEvent({
        delay: 260,
        loop: true,
        callback: () => {
          frame = (frame + 1) % waterKeys.length;
          strip.setTexture(waterKeys[frame]);
        }
      });
      this.tweens.add({
        targets: strip,
        tilePositionX: 32,
        duration: 9000,
        repeat: -1,
        ease: 'Sine.easeInOut',
        yoyo: true
      });
    } else {
      // Fallback: a calm solid water band.
      this.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.78, GAME_WIDTH, GAME_HEIGHT * 0.44, 0x2a6f8e)
        .setAlpha(0.85)
        .setDepth(2);
    }

    // Distant pine silhouettes along the horizon for depth (real art if present).
    this.buildTreeline();

    // Drifting ambient motes for subtle motion.
    this.buildMotes();

    // Vignette to focus the eye on the title/buttons.
    const vignette = this.add.graphics().setDepth(20);
    vignette.fillStyle(0x000000, 0.28);
    vignette.fillRect(0, 0, GAME_WIDTH, 24);
    vignette.fillRect(0, GAME_HEIGHT - 24, GAME_WIDTH, 24);
  }

  private buildTreeline(): void {
    const pineKey = ArtRegistry.nature('pine_tree');
    const horizonY = Math.floor(GAME_HEIGHT * 0.56);
    if (!this.textures.exists(pineKey)) return;
    const rng = new Phaser.Math.RandomDataGenerator(['river-run-menu-treeline']);
    for (let x = 6; x < GAME_WIDTH; x += rng.between(18, 30)) {
      const t = this.add.image(x, horizonY + 2, pineKey, 0).setOrigin(0.5, 1).setDepth(3);
      const s = rng.realInRange(0.7, 1.1);
      t.setScale(s);
      t.setTint(0x2e4a44); // pushed back into the haze
      t.setAlpha(0.85);
    }
  }

  private buildMotes(): void {
    const rng = new Phaser.Math.RandomDataGenerator(['river-run-menu-motes']);
    for (let i = 0; i < 22; i++) {
      const x = rng.between(0, GAME_WIDTH);
      const y = rng.between(20, GAME_HEIGHT - 30);
      const mote = this.add.circle(x, y, rng.realInRange(0.6, 1.4), 0xf4f0e6, rng.realInRange(0.15, 0.5)).setDepth(15);
      this.motes.push(mote);
      this.tweens.add({
        targets: mote,
        y: y - rng.between(10, 26),
        x: x + rng.between(-8, 8),
        alpha: 0,
        duration: rng.between(4000, 8000),
        repeat: -1,
        delay: rng.between(0, 4000),
        onRepeat: () => {
          mote.y = y;
          mote.x = x;
          mote.setAlpha(rng.realInRange(0.15, 0.5));
        }
      });
    }
  }

  // ---- Title ---------------------------------------------------------------
  private buildTitle(): void {
    const cx = new UIAnchor(this).center().x;
    const titleY = Math.floor(GAME_HEIGHT * 0.26);

    const title = this.add
      .text(cx, titleY, 'RIVER RUN', {
        fontFamily: UI_THEME.font.family,
        fontSize: '34px',
        color: UI_THEME.hex.gold,
        stroke: UI_THEME.hex.dark,
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setDepth(21);

    const subtitle = this.add
      .text(cx, titleY + 26, 'F I S H I N G', {
        fontFamily: UI_THEME.font.family,
        fontSize: '14px',
        color: UI_THEME.hex.white,
        stroke: UI_THEME.hex.dark,
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(21);
    subtitle.setLetterSpacing?.(2);

    // Gentle breathing bob on the title block.
    this.tweens.add({
      targets: [title, subtitle],
      y: '-=2',
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ---- Buttons -------------------------------------------------------------
  private buildButtons(): void {
    const cx = new UIAnchor(this).center().x;
    let y = Math.floor(GAME_HEIGHT * 0.52);
    const gap = 22;
    const w = 168;
    const h = 26;

    const hasSave = SaveSystem.hasAnySave();

    // Continue — most-recent save (disabled if none).
    const continueBtn = new TextButton(this, {
      x: cx, y, width: w, height: h, label: 'Continue', variant: 'primary',
      enabled: hasSave,
      onClick: () => {
        const slot = SaveSystem.lastSlot();
        if (slot === null) return;
        this.startGame({ loadSlot: slot });
      }
    });
    continueBtn.setDepth(22);
    y += gap;

    // Play — quick into a fresh session (no slot bound until you save).
    const playBtn = new TextButton(this, {
      x: cx, y, width: w, height: h, label: 'Play', variant: 'confirm',
      onClick: () => this.startGame({})
    });
    playBtn.setDepth(22);
    y += gap;

    // New Game — explicit fresh start (also fine to keep alongside Play).
    const newGameBtn = new TextButton(this, {
      x: cx, y, width: w, height: h, label: 'New Game', variant: 'primary',
      onClick: () => this.startGame({ newGame: true })
    });
    newGameBtn.setDepth(22);
    y += gap;

    // Settings.
    const settingsBtn = new TextButton(this, {
      x: cx, y, width: w, height: h, label: 'Settings', variant: 'ghost',
      onClick: () => this.scene.start(SCENE_KEYS.SETTINGS, { from: SCENE_KEYS.MENU })
    });
    settingsBtn.setDepth(22);
    y += gap;

    // Credits.
    const creditsBtn = new TextButton(this, {
      x: cx, y, width: w, height: h, label: 'Credits', variant: 'ghost',
      onClick: () => this.scene.start(SCENE_KEYS.CREDITS, { from: SCENE_KEYS.MENU })
    });
    creditsBtn.setDepth(22);

    // Version / build footer.
    this.add
      .text(GAME_WIDTH - 6, GAME_HEIGHT - 6, 'vertical slice build', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.tiny,
        color: UI_THEME.hex.slate
      })
      .setOrigin(1, 1)
      .setDepth(22)
      .setAlpha(0.7);

    // Keyboard navigation (Up/Down/W/S to move, Enter/Space to select),
    // layered on top of the existing mouse interactions. Starts focus on
    // Continue if a save exists, otherwise Play.
    const navButtons = [continueBtn, playBtn, newGameBtn, settingsBtn, creditsBtn];
    const nav = new MenuNav(this, navButtons, hasSave ? 0 : 1);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => nav.destroy());
  }

  private startGame(data: { loadSlot?: number; newGame?: boolean }): void {
    this.cameras.main.fadeOut(350, 11, 15, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.MAIN, data);
    });
  }
}
