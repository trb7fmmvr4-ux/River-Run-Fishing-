import { EventBus } from '../utils/EventBus';
import { Cooler } from './Cooler';
import { GoldWallet } from './GoldWallet';
import { SHOP_UPGRADES, type ShopUpgradeDef } from '../data/ShopData';

export const ShopEvents = {
  SOLD: 'shop-sold',
  PURCHASED: 'shop-purchased',
  PURCHASE_FAILED: 'shop-purchase-failed'
} as const;

/** Re-export so callers only need to import from Shop. */
export type { ShopUpgradeDef as ShopUpgrade };

/**
 * Orchestrates the two "exchange" actions of the economy: turning Cooler
 * contents into gold, and spending gold on basic upgrades.
 *
 * Deliberately the only class that holds references to both Cooler and
 * GoldWallet — neither of them knows the other (or this class) exists.
 * Only one upgrade exists for now (expanding Cooler capacity); the array
 * shape is so more can be added later as plain data, without new logic.
 */
export class Shop {
  public readonly cooler: Cooler;
  public readonly wallet: GoldWallet;
  public readonly upgrades: ShopUpgradeDef[];

  constructor(cooler: Cooler, wallet: GoldWallet) {
    this.cooler = cooler;
    this.wallet = wallet;
    this.upgrades = SHOP_UPGRADES;
  }

  /** Sells everything currently in the cooler. Returns the gold earned. */
  public sellAllFish(): number {
    const total = this.cooler.removeAllFish();
    if (total > 0) {
      this.wallet.add(total);
      EventBus.emit(ShopEvents.SOLD, total);
    }
    return total;
  }

  /** Sells one unit of the given fish. Returns the gold earned (0 if it wasn't there). */
  public sellFish(fishId: string): number {
    const value = this.cooler.removeFish(fishId);
    if (value === null) return 0;

    this.wallet.add(value);
    EventBus.emit(ShopEvents.SOLD, value);
    return value;
  }

  public buyUpgrade(upgradeId: string): boolean {
    const upgrade = this.upgrades.find((candidate) => candidate.id === upgradeId);
    if (!upgrade) return false;

    if (!this.wallet.spend(upgrade.cost)) {
      EventBus.emit(ShopEvents.PURCHASE_FAILED, upgrade);
      return false;
    }

    upgrade.apply(this);
    EventBus.emit(ShopEvents.PURCHASED, upgrade);
    return true;
  }
}
