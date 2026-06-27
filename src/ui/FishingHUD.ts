import Phaser from 'phaser';
import { DEPTH, TEXTURE_KEYS } from '../config/GameConfig';
import { createBusSubscription } from '../utils/EventBus';
import { ArtRegistry } from '../utils/AssetRegistry';
import { PlaceholderSound } from '../utils/PlaceholderSound';
import { FishingEvents } from '../systems/FishingSystem';
import { CoolerEvents } from '../systems/Cooler';
import type { FishDefinition, FishRarity } from '../data/FishData';
import type { Player } from '../entities/Player';
import { getRodTipOffset } from '../entities/HeldEquipmentVisual';
import { WORLD } from '../config/GameConfig';
import { spawnParticleBurst } from '../utils/ParticleBurst';

const MESSAGE_OFFSET_Y = -22;
const MESSAGE_PAD_X = 6;
const MESSAGE_PAD_Y = 3;
const MESSAGE_POP_MS = 160;
const MESSAGE_FADE_MS = 350;

const BAR_OFFSET_Y = -10;
const BAR_WIDTH = 36;
const BAR_HEIGHT = 5;
const BAR_DANGER_FRACTION = 0.25;
const BAR_WARN_FRACTION = 0.5;

// Cast distance: toward the cursor, clamped between these — replaces the
// previous fixed (13, 3) offset, which was barely larger than the player
// sprite itself and felt unnaturally short (confirmed against a real
// browser screenshot, not just a code-read guess).
const MIN_CAST_DISTANCE = 1.5 * WORLD.TILE_SIZE;
const MAX_CAST_DISTANCE = 9 * WORLD.TILE_SIZE;
const BOBBER_BOB_PX = 2;
const BOBBER_BOB_MS = 600;

/** How much bigger/brighter a catch's celebration is, purely cosmetic — no value/economy implications. */
const RARITY_FLAIR: Record<FishRarity, { color: string; burstColor: number; burstCount: number; flash: [number, number, number] }> = {
  common: { color: '#8cffb0', burstColor: 0x8cffb0, burstCount: 5, flash: [140, 255, 176] },
  uncommon: { color: '#7fd9ff', burstColor: 0x7fd9ff, burstCount: 7, flash: [127, 217, 255] },
  rare: { color: '#ffd27f', burstColor: 0xffd27f, burstCount: 10, flash: [255, 210, 127] },
  legendary: { color: '#ffb1f4', burstColor: 0xffb1f4, burstCount: 14, flash: [255, 177, 244] },
  exotic: { color: '#ff7ce0', burstColor: 0xff7ce0, burstCount: 20, flash: [255, 124, 224] }
};

/**
 * Turns FishingSystem's events into the full feel of fishing: a popping
 * message with a backdrop, a color-shifting reaction bar, a bobber that
 * floats, twitches, dips, and either celebrates or sinks, a scatter of
 * sparks on a catch, camera shake/flash, and placeholder SFX.
 *
 * Purely a presentation layer — it never touches fishing state directly,
 * it only reacts to events on the shared EventBus.
 */
export class FishingHUD {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly sound = new PlaceholderSound();
  private readonly subscriptions = createBusSubscription();

  private readonly messageText: Phaser.GameObjects.Text;
  private readonly messageBackdrop: Phaser.GameObjects.Graphics;
  private readonly barGraphics: Phaser.GameObjects.Graphics;
  private readonly bobber: Phaser.GameObjects.Sprite;
  private readonly lineGraphics: Phaser.GameObjects.Graphics;

  private messageTween?: Phaser.Tweens.Tween;
  private messagePopTween?: Phaser.Tweens.Tween;
  private bobberBobTween?: Phaser.Tweens.Tween;

  private reactionActive = false;
  private reactionDeadline = 0;
  private reactionDurationMs = 0;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;

    this.messageBackdrop = scene.add.graphics().setDepth(DEPTH.HUD_BACKDROP);

    this.messageText = scene.add
      .text(player.x, player.y + MESSAGE_OFFSET_Y, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        stroke: '#0b0f14',
        strokeThickness: 3
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.HUD)
      .setAlpha(0);

    this.barGraphics = scene.add.graphics().setDepth(DEPTH.HUD);
    this.barGraphics.setVisible(false);

    this.bobber = scene.add.sprite(0, 0, TEXTURE_KEYS.BOBBER).setDepth(DEPTH.BOBBER).setVisible(false);

    // The fishing line, drawn just beneath the bobber so the bobber sits
    // on top of it. Updated every frame while the bobber is visible.
    this.lineGraphics = scene.add.graphics().setDepth(DEPTH.BOBBER - 0.1).setVisible(false);

    this.subscriptions.on(FishingEvents.CAST, this.onCast, this);
    this.subscriptions.on(FishingEvents.TENSION, this.onTension, this);
    this.subscriptions.on(FishingEvents.BITE, this.onBite, this);
    this.subscriptions.on(FishingEvents.CATCH_SUCCESS, this.onCatchSuccess, this);
    this.subscriptions.on(FishingEvents.CATCH_FAILURE, this.onCatchFailure, this);
    this.subscriptions.on(FishingEvents.NOT_IN_ZONE, this.onNotInZone, this);
    this.subscriptions.on(FishingEvents.CANCELLED, this.onCancelled, this);
    this.subscriptions.on(CoolerEvents.FULL, this.onCoolerFull, this);
  }

  // ---- Event handlers --------------------------------------------------

  private onCast(): void {
    this.showMessage('Cast...', '#bfe3ff', 900);
    this.hideReactionBar();
    this.showBobber();
    this.sound.playCast();
  }

  private onTension(): void {
    this.twitchBobber();
  }

  private onBite(_fish: FishDefinition, windowMs: number): void {
    this.showMessage('Bite! Click to hook it!', '#fff1a8', 1100);
    this.showReactionBar(windowMs);
    this.dipBobber();
    this.scene.cameras.main.shake(90, 0.0025);
    this.sound.playBite();
  }

  private onCatchSuccess(fish: FishDefinition): void {
    const flair = RARITY_FLAIR[fish.rarity];

    this.showMessage(`Caught: ${fish.name}!`, flair.color, 1500);
    this.hideReactionBar();
    this.celebrateBobber();
    this.spawnBurst(this.player.x, this.player.y - 6, flair.burstColor, flair.burstCount);
    this.scene.cameras.main.flash(140, flair.flash[0], flair.flash[1], flair.flash[2], false);
    this.sound.playCatchSuccess();
    this.showCaughtFish(fish);
  }

  /**
   * Pops the real fish sprite above the player on a catch (a little
   * "show off your catch" flourish), if the fish art is loaded. Purely
   * cosmetic and self-cleaning; does nothing if the art isn't present.
   */
  private showCaughtFish(fish: FishDefinition): void {
    const key = ArtRegistry.fish(fish.id);
    if (!this.scene.textures.exists(key)) return;

    // Frame 0 = the fish's crop within the packed sheet. Without it, the
    // texture's default __BASE frame would render the entire sheet.
    const sprite = this.scene.add
      .image(this.player.x, this.player.y - 10, key, 0)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.HUD_PARTICLES)
      .setScale(0)
      .setAlpha(0);

    // Pop up + rise, hold, then fade out and destroy.
    this.scene.tweens.add({
      targets: sprite,
      scale: 1,
      alpha: 1,
      y: this.player.y - 22,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: sprite,
          alpha: 0,
          y: sprite.y - 8,
          delay: 700,
          duration: 320,
          onComplete: () => sprite.destroy()
        });
      }
    });
  }

  private onCatchFailure(): void {
    this.showMessage('Failed catch...', '#ff9d9d', 1400);
    this.hideReactionBar();
    this.sinkBobber();
    this.scene.cameras.main.shake(140, 0.0018);
    this.sound.playCatchFailure();
  }

  private onNotInZone(): void {
    this.showMessage('Need to be in the water...', '#9fb3c8', 800);
  }

  /** The cast was abandoned (walked away / switched tools) — clear the line quietly, no catch fanfare. */
  private onCancelled(): void {
    this.hideReactionBar();
    this.hideBobber();
  }

  /**
   * Fires in the same tick as CATCH_SUCCESS when the cooler couldn't
   * store the fish, so it's delayed until just after the catch
   * celebration finishes instead of overwriting it immediately.
   */
  private onCoolerFull(): void {
    this.scene.time.delayedCall(1600, () => {
      this.showMessage('Cooler full! Lost the catch.', '#ff9d9d', 1400);
    });
  }

  // ---- Message + backdrop -----------------------------------------------

  /**
   * Public hook for system-level notifications (e.g. "Game saved") that
   * aren't part of the fishing flow. Reuses the existing message banner
   * so styling stays consistent; purely additive.
   */
  public flashSystemMessage(text: string, holdMs = 1200): void {
    this.showMessage(text, '#8cffb0', holdMs);
  }

  private showMessage(text: string, color: string, holdMs: number): void {
    this.messageTween?.stop();
    this.messagePopTween?.stop();

    this.messageText.setText(text);
    this.messageText.setColor(color);
    this.messageText.setAlpha(1);
    this.messageText.setScale(0.7);

    this.messagePopTween = this.scene.tweens.add({
      targets: this.messageText,
      scale: 1,
      duration: MESSAGE_POP_MS,
      ease: 'Back.easeOut'
    });

    this.messageTween = this.scene.tweens.add({
      targets: this.messageText,
      alpha: 0,
      delay: holdMs,
      duration: MESSAGE_FADE_MS,
      ease: 'Quad.easeIn'
    });
  }

  // ---- Reaction bar -------------------------------------------------------

  private showReactionBar(durationMs: number): void {
    this.reactionDeadline = this.scene.time.now + durationMs;
    this.reactionDurationMs = durationMs;
    this.reactionActive = true;
    this.barGraphics.setVisible(true);
  }

  private hideReactionBar(): void {
    this.reactionActive = false;
    this.barGraphics.setVisible(false);
    this.barGraphics.clear();
  }

  // ---- Bobber -------------------------------------------------------------

  /** A single expanding, fading ring — call twice with a stagger for a believable double-ripple. */
  private spawnRipple(x: number, y: number, delayMs: number): void {
    this.scene.time.delayedCall(delayMs, () => {
      const ring = this.scene.add
        .circle(x, y, 6, 0, 0)
        .setStrokeStyle(1, 0xdfeefc, 0.6)
        .setDepth(DEPTH.BOBBER - 1);
      this.scene.tweens.add({
        targets: ring,
        scale: 3,
        alpha: 0,
        duration: 500,
        ease: 'Sine.easeOut',
        onComplete: () => ring.destroy()
      });
    });
  }

  private showBobber(): void {
    this.bobberBobTween?.stop();

    const rodTip = getRodTipOffset(this.player.animator.currentDirection);
    const originX = this.player.x + rodTip.x;
    const originY = this.player.y + rodTip.y;

    // Phaser's pointer.worldX/worldY already accounts for the camera's
    // current zoom/scroll, so this is the cursor's actual world position
    // with no manual conversion needed.
    const pointer = this.scene.input.activePointer;
    const dx = pointer.worldX - originX;
    const dy = pointer.worldY - originY;
    const rawDistance = Math.hypot(dx, dy);

    // Cast toward the cursor's direction, but the distance is always
    // clamped — too close snaps to the minimum (so clicking right next to
    // the player doesn't cast at zero range), too far snaps to the
    // maximum (so the cast never exceeds a sane rod length).
    const distance = Phaser.Math.Clamp(rawDistance, MIN_CAST_DISTANCE, MAX_CAST_DISTANCE);
    const angle = rawDistance > 0.0001 ? Math.atan2(dy, dx) : 0;
    const x = originX + Math.cos(angle) * distance;
    const y = originY + Math.sin(angle) * distance;

    this.bobber.setPosition(x, y);
    this.bobber.setScale(1);
    this.bobber.setAlpha(1);
    this.bobber.setVisible(true);
    this.lineGraphics.setVisible(true);

    // Landing splash + a couple of expanding ripple rings — the cast
    // previously had no feedback at all for where the line actually
    // landed, which made the (now much longer, cursor-aimed) cast feel
    // disconnected from the water. Small and quick; never blocks input.
    spawnParticleBurst(this.scene, x, y, { count: 5, color: 0xdfeefc, radius: 10, depth: DEPTH.BOBBER - 1 });
    this.spawnRipple(x, y, 0);
    this.spawnRipple(x, y, 120);

    this.bobberBobTween = this.scene.tweens.add({
      targets: this.bobber,
      y: y - BOBBER_BOB_PX,
      duration: BOBBER_BOB_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /** A quick squash — "something brushed the line" — without committing to a real bite. */
  private twitchBobber(): void {
    if (!this.bobber.visible) return;

    this.scene.tweens.add({
      targets: this.bobber,
      scaleX: 1.35,
      scaleY: 0.7,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
  }

  private dipBobber(): void {
    this.bobberBobTween?.stop();

    this.scene.tweens.add({
      targets: this.bobber,
      y: this.bobber.y + 7,
      duration: 110,
      ease: 'Quad.easeOut'
    });
  }

  private celebrateBobber(): void {
    this.scene.tweens.add({
      targets: this.bobber,
      y: this.bobber.y - 12,
      scale: 1.3,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => this.hideBobber()
    });
  }

  private sinkBobber(): void {
    this.scene.tweens.add({
      targets: this.bobber,
      y: this.bobber.y + 6,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => this.hideBobber()
    });
  }

  private hideBobber(): void {
    this.bobberBobTween?.stop();
    this.bobber.setVisible(false);
    this.lineGraphics.setVisible(false);
    this.lineGraphics.clear();
  }

  // ---- Catch sparks ---------------------------------------------------------

  private spawnBurst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.3, 0.3);
      const distance = Phaser.Math.Between(10, 22);

      const spark = this.scene.add.circle(x, y, 2, color, 1).setDepth(DEPTH.HUD_PARTICLES);

      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 420,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy()
      });
    }
  }

  // ---- Per-frame update -------------------------------------------------

  /** Call once per frame from the owning scene's update loop. */
  public update(): void {
    this.updateMessage();
    this.updateReactionBar();
    this.updateFishingLine();
  }

  /**
   * Draws the line from the rod tip (the same per-direction offset the
   * held-rod icon uses — one shared source of truth, see
   * HeldEquipmentVisual.getRodTipOffset) to the bobber, every frame while
   * the bobber is visible. Lightweight: one clear + one line per frame,
   * only when fishing — no allocation, no cost at all while idle.
   */
  private updateFishingLine(): void {
    if (!this.bobber.visible) return;

    const rodTip = getRodTipOffset(this.player.animator.currentDirection);
    this.lineGraphics.clear();
    this.lineGraphics.lineStyle(1, 0xf4f0e6, 0.7);
    this.lineGraphics.lineBetween(
      this.player.x + rodTip.x,
      this.player.y + rodTip.y,
      this.bobber.x,
      this.bobber.y
    );
  }

  private updateMessage(): void {
    const x = this.player.x;
    const y = this.player.y + MESSAGE_OFFSET_Y;
    this.messageText.setPosition(x, y);

    this.messageBackdrop.clear();
    if (this.messageText.alpha <= 0.02) return;

    const width = this.messageText.displayWidth + MESSAGE_PAD_X * 2;
    const height = this.messageText.displayHeight + MESSAGE_PAD_Y * 2;
    const backdropX = x - width / 2;
    const backdropY = y - this.messageText.displayHeight - MESSAGE_PAD_Y;

    this.messageBackdrop.fillStyle(0x0b0f14, 0.55 * this.messageText.alpha);
    this.messageBackdrop.fillRoundedRect(backdropX, backdropY, width, height, 4);
  }

  private updateReactionBar(): void {
    if (!this.reactionActive) return;

    const remaining = Phaser.Math.Clamp(
      (this.reactionDeadline - this.scene.time.now) / this.reactionDurationMs,
      0,
      1
    );

    // Blink in the last quarter of the window so urgency is felt, not just timed.
    const blinking = remaining < BAR_DANGER_FRACTION && Math.floor(this.scene.time.now / 100) % 2 === 0;

    this.barGraphics.clear();
    if (blinking) return;

    const barColor = remaining > BAR_WARN_FRACTION ? 0x8cffb0 : remaining > BAR_DANGER_FRACTION ? 0xf4c170 : 0xff5d5d;

    const barX = this.player.x - BAR_WIDTH / 2;
    const barY = this.player.y + BAR_OFFSET_Y;

    this.barGraphics.fillStyle(0x0b0f14, 0.6);
    this.barGraphics.fillRect(barX, barY, BAR_WIDTH, BAR_HEIGHT);
    this.barGraphics.fillStyle(barColor, 1);
    this.barGraphics.fillRect(barX, barY, BAR_WIDTH * remaining, BAR_HEIGHT);
  }

  public destroy(): void {
    this.messageTween?.stop();
    this.messagePopTween?.stop();
    this.bobberBobTween?.stop();

    this.subscriptions.dispose();

    this.sound.destroy();
    this.messageText.destroy();
    this.messageBackdrop.destroy();
    this.barGraphics.destroy();
    this.bobber.destroy();
    this.lineGraphics.destroy();
  }
}
