/**
 * Shop upgrade catalogue — pure data, zero Phaser dependency.
 *
 * Each entry describes one purchasable upgrade: its id (stable key for
 * lookups), the label shown in the ShopPanel, its gold cost, and the
 * effect expressed as an opaque action callback. Shop.buyUpgrade() finds
 * the entry by id and calls apply().
 *
 * Adding a new upgrade means adding one object here and, if it affects
 * a new system, adding that system to the Shop constructor's dependency
 * list — nothing else needs changing.
 */

import type { Shop } from '../systems/Shop';

export interface ShopUpgradeDef {
  readonly id: string;
  readonly label: string;
  readonly cost: number;
  readonly apply: (shop: Shop) => void;
}

export const SHOP_UPGRADES: ShopUpgradeDef[] = [
  {
    id: 'cooler-capacity',
    label: 'Expand Cooler (+5)',
    cost: 40,
    apply: (shop) => shop.cooler.expandCapacity(5)
  }
];
