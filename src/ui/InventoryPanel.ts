import Phaser from 'phaser';
import { DEPTH } from '../config/GameConfig';
import { createBusSubscription } from '../utils/EventBus';
import { center, fitSize } from './ScreenLayout';
import { CoolerEvents } from '../systems/Cooler';
import type { Cooler } from '../systems/Cooler';
import type { Inventory } from '../systems/Inventory';
import type { Shop } from '../systems/Shop';
import type { BaitSystem } from '../systems/BaitSystem';
import type { Progression } from '../systems/Progression';
import { ProgressionEvents } from '../systems/Progression';
import { BAIT_TABLE, getBait } from '../data/BaitData';
import { PlaceholderSound } from '../utils/PlaceholderSound';
import { Tooltip } from './theme/Tooltip';

const PANEL_DEPTH = DEPTH.PANEL;

/**
 * Toggleable panel (press I) showing the general Inventory — currently
 * always empty, reserved for future items like bait or crafting
 * materials — and the Cooler's contents, with a clickable "Sell All".
 *
 * Lives in HUDScene, whose camera never zooms or scrolls — every element
 * is positioned once, here, at a fixed screen coordinate. No per-frame
 * layout pass exists anymore; there's no camera transform for it to
 * track.
 */
export class InventoryPanel {
  private readonly inventory: Inventory;
  private readonly cooler: Cooler;
  private readonly shop: Shop;

  private readonly background: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly sellButton: Phaser.GameObjects.Rectangle;
  private readonly sellButtonText: Phaser.GameObjects.Text;
  private readonly bait?: BaitSystem;
  private readonly progression?: Progression;
  private readonly baitButton: Phaser.GameObjects.Rectangle;
  private readonly baitButtonText: Phaser.GameObjects.Text;
  private readonly sound: PlaceholderSound;
  private readonly subscriptions = createBusSubscription();
  private readonly panelWidth: number;
  private readonly panelHeight: number;

  private open = false;

  /** `tooltip` is shared, owned by HUDScene — see GoldHUD's constructor doc for why this isn't created here. */
  constructor(
    scene: Phaser.Scene,
    inventory: Inventory,
    cooler: Cooler,
    shop: Shop,
    tooltip: Tooltip,
    bait?: BaitSystem,
    progression?: Progression
  ) {
    this.inventory = inventory;
    this.cooler = cooler;
    this.shop = shop;
    this.bait = bait;
    this.progression = progression;
    this.sound = new PlaceholderSound();

    // Desired size, clamped to the design resolution — this panel can
    // never overflow off-screen. Height increased from the original 200
    // after a real overlap was observed in a browser screenshot: this
    // panel's text content grows with however many cooler/inventory items
    // exist, and the previous height left the bait/sell buttons' fixed
    // positions too close to where that variable-height text could reach.
    const fit = fitSize(230, 230);
    this.panelWidth = fit.width;
    this.panelHeight = fit.height;
    const sellOffsetY = this.panelHeight / 2 - 20;
    const textOffsetY = -(this.panelHeight / 2) + 14;
    const baitOffsetY = sellOffsetY - 26;

    const c = center();
    this.background = scene.add.graphics().setPosition(c.x, c.y).setDepth(PANEL_DEPTH).setVisible(false);
    this.drawBackground();

    const textPos = center(0, textOffsetY);
    this.text = scene.add
      .text(textPos.x, textPos.y, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        align: 'left',
        lineSpacing: 3
      })
      .setOrigin(0.5, 0)
      .setDepth(PANEL_DEPTH + 1)
      .setVisible(false);

    const sellPos = center(0, sellOffsetY);
    this.sellButton = scene.add
      .rectangle(sellPos.x, sellPos.y, this.panelWidth - 32, 24, 0xf4c170, 0.95)
      .setDepth(PANEL_DEPTH + 1)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.sellButtonText = scene.add
      .text(sellPos.x, sellPos.y, 'Sell All', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#241405'
      })
      .setOrigin(0.5)
      .setDepth(PANEL_DEPTH + 2)
      .setVisible(false);

    this.sellButton.on('pointerdown', () => this.handleSellAll());

    // Bait selector: a small button that cycles the equipped bait. Reuses
    // this panel (no new inventory UI). Hidden entirely if no bait system
    // was provided, so the panel still works for any other caller.
    const baitPos = center(0, baitOffsetY);
    this.baitButton = scene.add
      .rectangle(baitPos.x, baitPos.y, this.panelWidth - 32, 20, 0x14323a, 0.95)
      .setDepth(PANEL_DEPTH + 1)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.baitButtonText = scene.add
      .text(baitPos.x, baitPos.y, '', { fontFamily: 'monospace', fontSize: '10px', color: '#8cffb0' })
      .setOrigin(0.5)
      .setDepth(PANEL_DEPTH + 2)
      .setVisible(false);
    this.baitButton.on('pointerdown', () => this.cycleBait());
    if (this.bait) {
      tooltip.attach(this.baitButton, () => getBait(this.bait!.equippedId)?.description ?? '');
    }

    this.subscriptions.on(CoolerEvents.CHANGED, this.onCoolerChanged, this);
    if (this.progression) this.subscriptions.on(ProgressionEvents.CHANGED, this.onCoolerChanged, this);
  }

  /** Cycle to the next bait in the catalogue and equip it immediately. */
  private cycleBait(): void {
    if (!this.bait || !this.open) return;
    this.sound.playConfirm();
    const ids = BAIT_TABLE.map((b) => b.id);
    const idx = ids.indexOf(this.bait.equippedId);
    const next = ids[(idx + 1) % ids.length];
    this.bait.equip(next); // fishing reads equippedId live; save captures it
    this.refresh();
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
    this.sellButton.setVisible(visible);
    this.sellButtonText.setVisible(visible);
    const baitVisible = visible && !!this.bait;
    this.baitButton.setVisible(baitVisible);
    this.baitButtonText.setVisible(baitVisible);
  }

  private onCoolerChanged(): void {
    if (this.open) this.refresh();
  }

  private handleSellAll(): void {
    if (!this.open) return;
    const total = this.shop.sellAllFish();
    if (total > 0) this.sound.playSell();
    // refresh() runs automatically via the CoolerEvents.CHANGED listener.
  }

  private refresh(): void {
    const lines: string[] = [];
    if (this.progression) {
      const p = this.progression;
      lines.push(`Fish Lv${p.level('fishing')}  Combat Lv${p.level('combat')}  Craft Lv${p.level('crafting')}`);
      lines.push('');
    }
    lines.push('INVENTORY');

    const items = this.inventory.list();
    if (items.length === 0) {
      lines.push('  (empty — reserved for future items)');
    } else {
      for (const stack of items) {
        lines.push(`  ${stack.itemId} x${stack.quantity}`);
      }
    }

    lines.push('');
    lines.push(`COOLER (${this.cooler.count}/${this.cooler.capacity})`);

    const fish = this.cooler.listFish();
    if (fish.length === 0) {
      lines.push('  (nothing caught yet)');
    } else {
      for (const stack of fish) {
        lines.push(`  ${stack.name} x${stack.quantity}  (${stack.unitValue}g each)`);
      }
    }

    lines.push('');
    if (this.bait) {
      lines.push(`BAIT: ${this.bait.equippedName}`);
      this.baitButtonText.setText('\u25B6 Change Bait');
    }

    this.text.setText(lines.join('\n'));
  }

  /** Drawn once, in local coordinates centered on the Graphics object's own origin. */
  private drawBackground(): void {
    const x = -this.panelWidth / 2;
    const y = -this.panelHeight / 2;

    this.background.fillStyle(0x0b0f14, 0.88);
    this.background.fillRoundedRect(x, y, this.panelWidth, this.panelHeight, 6);
    this.background.lineStyle(1, 0xf4c170, 0.6);
    this.background.strokeRoundedRect(x, y, this.panelWidth, this.panelHeight, 6);
  }

  public destroy(): void {
    this.subscriptions.dispose();
    this.background.destroy();
    this.text.destroy();
    this.sellButton.destroy();
    this.sellButtonText.destroy();
    this.baitButton.destroy();
    this.baitButtonText.destroy();
    this.sound.destroy();
  }
}
