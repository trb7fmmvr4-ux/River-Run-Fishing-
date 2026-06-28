import Phaser from 'phaser';
import { DEPTH } from '../config/GameConfig';
import { createBusSubscription } from '../utils/EventBus';
import { center, fitSize } from './ScreenLayout';
import { ShopEvents } from '../systems/Shop';
import { GoldEvents } from '../systems/GoldWallet';
import type { Shop } from '../systems/Shop';
import { PlaceholderSound } from '../utils/PlaceholderSound';

const PANEL_DEPTH = DEPTH.PANEL;

/**
 * Toggleable panel (press B) showing the shop's upgrade(s) with a
 * clickable "Buy" action. Only one upgrade exists right now — expanding
 * Cooler capacity — by design (`Shop.upgrades` is where more would be
 * added later, as data, not new logic here).
 *
 * Lives in HUDScene — every element positioned once at a fixed screen
 * coordinate; no per-frame layout pass.
 */
export class ShopPanel {
  private readonly bus = createBusSubscription();
  private readonly scene: Phaser.Scene;
  private readonly shop: Shop;

  private readonly background: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly buyButton: Phaser.GameObjects.Rectangle;
  private readonly buyButtonText: Phaser.GameObjects.Text;
  private readonly sound: PlaceholderSound;
  private readonly panelWidth: number;
  private readonly panelHeight: number;

  private open = false;

  constructor(scene: Phaser.Scene, shop: Shop) {
    this.scene = scene;
    this.shop = shop;
    this.sound = new PlaceholderSound();

    const fit = fitSize(220, 130);
    this.panelWidth = fit.width;
    this.panelHeight = fit.height;
    const buyOffsetY = this.panelHeight / 2 - 20;
    const textOffsetY = -(this.panelHeight / 2) + 14;

    const c = center();
    this.background = scene.add.graphics().setPosition(c.x, c.y).setDepth(PANEL_DEPTH).setVisible(false);
    this.drawBackground();

    const textPos = center(0, textOffsetY);
    this.text = scene.add
      .text(textPos.x, textPos.y, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        align: 'left',
        lineSpacing: 3
      })
      .setOrigin(0.5, 0)
      .setDepth(PANEL_DEPTH + 1)
      .setVisible(false);

    const buyPos = center(0, buyOffsetY);
    this.buyButton = scene.add
      .rectangle(buyPos.x, buyPos.y, this.panelWidth - 32, 24, 0x8cffb0, 0.95)
      .setDepth(PANEL_DEPTH + 1)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.buyButtonText = scene.add
      .text(buyPos.x, buyPos.y, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#0b2415'
      })
      .setOrigin(0.5)
      .setDepth(PANEL_DEPTH + 2)
      .setVisible(false);

    this.buyButton.on('pointerdown', () => this.handleBuy());

    this.bus.on(ShopEvents.PURCHASED, this.onPurchased, this);
    this.bus.on(ShopEvents.PURCHASE_FAILED, this.onPurchaseFailed, this);
    this.bus.on(GoldEvents.CHANGED, this.onGoldChanged, this);
  }

  public get isOpen(): boolean {
    return this.open;
  }

  public toggle(): void {
    this.open = !this.open;
    this.setVisible(this.open);
    if (this.open) {
      this.refresh();
    }
  }

  private setVisible(visible: boolean): void {
    this.background.setVisible(visible);
    this.text.setVisible(visible);
    this.buyButton.setVisible(visible);
    this.buyButtonText.setVisible(visible);
  }

  private onPurchased(): void {
    if (this.open) this.refresh();
  }

  private onGoldChanged(): void {
    if (this.open) this.refresh();
  }

  private onPurchaseFailed(): void {
    if (!this.open) return;

    this.scene.tweens.add({
      targets: [this.buyButton, this.buyButtonText],
      alpha: 0.3,
      duration: 80,
      yoyo: true
    });
  }

  private handleBuy(): void {
    if (!this.open) return;
    const bought = this.shop.buyUpgrade('cooler-capacity');
    if (bought) this.sound.playSell();
    // refresh()/the fail-flash run automatically via the listeners above.
  }

  private refresh(): void {
    const upgrade = this.shop.upgrades[0];
    const lines = [
      'SHOP',
      '',
      `Gold: ${this.shop.wallet.balance}g`,
      '',
      upgrade.label,
      `Cost: ${upgrade.cost}g`
    ];

    this.text.setText(lines.join('\n'));
    this.buyButtonText.setText(`Buy — ${upgrade.cost}g`);
  }

  /** Drawn once, in local coordinates centered on the Graphics object's own origin. */
  private drawBackground(): void {
    const x = -this.panelWidth / 2;
    const y = -this.panelHeight / 2;

    this.background.fillStyle(0x0b0f14, 0.88);
    this.background.fillRoundedRect(x, y, this.panelWidth, this.panelHeight, 6);
    this.background.lineStyle(1, 0x8cffb0, 0.6);
    this.background.strokeRoundedRect(x, y, this.panelWidth, this.panelHeight, 6);
  }

  public destroy(): void {
    this.bus.dispose();
    this.background.destroy();
    this.text.destroy();
    this.buyButton.destroy();
    this.buyButtonText.destroy();
    this.sound.destroy();
  }
}
