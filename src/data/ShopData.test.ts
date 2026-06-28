import { describe, it, expect } from 'vitest';
import { SHOP_UPGRADES } from './ShopData';

describe('ShopData', () => {
  it('has at least one upgrade', () => {
    expect(SHOP_UPGRADES.length).toBeGreaterThan(0);
  });

  it('every upgrade has a unique id', () => {
    const ids = SHOP_UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every upgrade has a non-empty label', () => {
    for (const u of SHOP_UPGRADES) {
      expect(u.label.trim().length, `upgrade ${u.id} has empty label`).toBeGreaterThan(0);
    }
  });

  it('every upgrade has a positive cost', () => {
    for (const u of SHOP_UPGRADES) {
      expect(u.cost, `upgrade ${u.id} has non-positive cost`).toBeGreaterThan(0);
    }
  });

  it('cooler-capacity upgrade exists', () => {
    const u = SHOP_UPGRADES.find((x) => x.id === 'cooler-capacity');
    expect(u).toBeDefined();
    expect(u!.cost).toBe(40);
  });
});
