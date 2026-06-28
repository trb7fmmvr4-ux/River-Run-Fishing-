import Phaser from 'phaser';
import { COMBAT, DEPTH } from '../config/GameConfig';
import { Health, HealthEvents } from '../systems/Health';
import { ArtRegistry } from '../utils/AssetRegistry';
import { createBusSubscription } from '../utils/EventBus';

export interface SlimeOptions {
  x: number;
  y: number;
  /** Movement speed in px/sec. Kept slow so the first encounter is gentle. */
  speed?: number;
  /** Hit points. The starter rod does 1 dmg, so 3 = three hits to kill. */
  hp?: number;
  /** Contact damage dealt to the player. */
  touchDamage?: number;
}

/**
 * A Green Slime — the first enemy.
 *
 * Simple, readable AI: idle until the player comes within aggro range,
 * then hop toward them; deal contact damage on overlap (handled by the
 * scene via Arcade overlap + this.touchDamage). Uses the real animated
 * slime art with a graceful fallback to a tinted circle.
 *
 * Built additively as its own entity with its own Health component — it
 * shares no code with Player and changes no existing system. Future
 * enemies can follow this same shape (sprite + Health + tiny AI).
 */
export class Slime extends Phaser.Physics.Arcade.Sprite {
  public readonly health: Health;
  public readonly touchDamage: number;
  private readonly bus = createBusSubscription();
  private readonly speed: number;
  private readonly aggroRange = COMBAT.SLIME.AGGRO_RANGE;
  private aiState: 'idle' | 'chase' | 'dead' = 'idle';
  private fallbackGfx?: Phaser.GameObjects.Arc;
  private animsBuilt = false;
  private readonly healthBarBg: Phaser.GameObjects.Rectangle;
  private readonly healthBarFill: Phaser.GameObjects.Rectangle;
  private readonly healthChangedEvent: string;

  constructor(scene: Phaser.Scene, options: SlimeOptions) {
    const idleKey = ArtRegistry.enemy('green_slime', 'idle');
    const hasArt = scene.textures.exists(idleKey);
    super(scene, options.x, options.y, hasArt ? idleKey : '__white', 0);

    this.speed = options.speed ?? COMBAT.SLIME.SPEED;
    this.touchDamage = options.touchDamage ?? COMBAT.SLIME.TOUCH_DAMAGE;
    this.health = new Health(options.hp ?? COMBAT.SLIME.HP, { invulnMs: 220, channel: `slime-${Phaser.Math.RND.uuid()}` });

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.PLAYER - 0.1);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(COMBAT.SLIME.BODY_W, COMBAT.SLIME.BODY_H);
    body.setCollideWorldBounds(true);

    if (hasArt) {
      this.buildAnims(scene);
      this.play('slime-idle', true);
    } else {
      // Fallback visual: a green blob.
      this.setVisible(false);
      this.fallbackGfx = scene.add.circle(options.x, options.y, 7, 0x6cb058).setDepth(DEPTH.PLAYER - 0.1);
      this.fallbackGfx.setStrokeStyle(1, 0x3f7a3a);
    }

    // Health bar — hidden until the slime is actually damaged, per the
    // "show enemy health when targeted or damaged" requirement, rather
    // than cluttering the screen with a bar over every idle slime.
    const barWidth = 16;
    this.healthBarBg = scene.add
      .rectangle(options.x, options.y - 14, barWidth, 3, 0x0b0f14, 0.85)
      .setDepth(DEPTH.PLAYER + 1)
      .setVisible(false);
    this.healthBarFill = scene.add
      .rectangle(options.x - barWidth / 2, options.y - 14, barWidth, 3, 0xe05a4f, 1)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.PLAYER + 2)
      .setVisible(false);

    this.healthChangedEvent = this.health.eventName(HealthEvents.CHANGED);
    this.bus.on(this.healthChangedEvent, this.refreshHealthBar, this);
  }

  private refreshHealthBar(): void {
    const pct = Phaser.Math.Clamp(this.health.value / this.health.maximum, 0, 1);
    this.healthBarFill.setScale(pct, 1);
    this.healthBarBg.setVisible(true);
    this.healthBarFill.setVisible(true);
    // Tint toward red as health drops, even though the base colour is
    // already a warning red — keeps it readable at a glance regardless.
    this.healthBarFill.setFillStyle(pct > 0.5 ? 0xe05a4f : 0xff3b30, 1);
  }

  /** Keep the bar pinned just above the slime's current position every frame. */
  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.healthBarBg.setPosition(this.x, this.y - 14);
    this.healthBarFill.setPosition(this.x - 8, this.y - 14);
  }

  private buildAnims(scene: Phaser.Scene): void {
    const make = (key: string, texKey: string, rate: number, repeat: number) => {
      if (scene.anims.exists(key)) return;
      const tex = scene.textures.get(texKey);
      const total = tex.frameTotal - 1; // minus __BASE
      if (total <= 0) return;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(texKey, { start: 0, end: total - 1 }),
        frameRate: rate,
        repeat
      });
    };
    make('slime-idle', ArtRegistry.enemy('green_slime', 'idle'), 4, -1);
    make('slime-move', ArtRegistry.enemy('green_slime', 'move'), 8, -1);
    make('slime-death', ArtRegistry.enemy('green_slime', 'death'), 8, 0);
    this.animsBuilt = true;
  }

  /** Per-frame AI. `target` is the player. */
  public think(target: Phaser.GameObjects.Components.Transform & { x: number; y: number }): void {
    if (this.aiState === 'dead') return;
    const body = this.body as Phaser.Physics.Arcade.Body;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (dist <= this.aggroRange) {
      if (this.aiState !== 'chase') {
        this.aiState = 'chase';
        if (this.animsBuilt) this.play('slime-move', true);
      }
      const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      body.velocity.x = Math.cos(angle) * this.speed;
      body.velocity.y = Math.sin(angle) * this.speed;
      this.setFlipX(Math.cos(angle) < 0);
    } else {
      if (this.aiState !== 'idle') {
        this.aiState = 'idle';
        if (this.animsBuilt) this.play('slime-idle', true);
      }
      body.velocity.x = 0;
      body.velocity.y = 0;
    }

    this.fallbackGfx?.setPosition(this.x, this.y);
  }

  /** Apply damage from a weapon hit. Returns true if this killed the slime. */
  public hurt(amount: number, now: number): boolean {
    if (this.aiState === 'dead') return false;
    const took = this.health.damage(amount, now, 'rod');
    if (!took) return false;

    // Hit flash.
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(COMBAT.SLIME.HIT_FLASH_MS, () => this.clearTint());
    if (this.fallbackGfx) {
      this.fallbackGfx.setFillStyle(0xffffff);
      this.scene.time.delayedCall(COMBAT.SLIME.HIT_FLASH_MS, () => this.fallbackGfx?.setFillStyle(0x6cb058));
    }

    if (this.health.isDead) {
      this.die();
      return true;
    }
    return false;
  }

  private die(): void {
    this.aiState = 'dead';
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;

    if (this.animsBuilt) {
      this.play('slime-death', true);
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.fadeOut());
    } else {
      this.fadeOut();
    }
  }

  private fadeOut(): void {
    const targets: Phaser.GameObjects.GameObject[] = [this];
    if (this.fallbackGfx) targets.push(this.fallbackGfx);
    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: 260,
      onComplete: () => this.destroy()
    });
  }

  public get isDead(): boolean {
    return this.aiState === 'dead';
  }

  public destroy(fromScene?: boolean): void {
    this.bus.dispose();
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
    this.fallbackGfx?.destroy();
    super.destroy(fromScene);
  }
}
