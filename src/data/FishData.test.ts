import { describe, it, expect } from 'vitest';
import { FISH_TABLE, fishForZone } from './FishData';

describe('FishData', () => {
  describe('FISH_TABLE integrity', () => {
    it('has at least one entry', () => {
      expect(FISH_TABLE.length).toBeGreaterThan(0);
    });

    it('every fish has a unique id', () => {
      const ids = FISH_TABLE.map((f) => f.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('every fish has a non-empty name', () => {
      for (const f of FISH_TABLE) {
        expect(f.name.trim().length, `fish ${f.id} has empty name`).toBeGreaterThan(0);
      }
    });

    it('every fish has positive value', () => {
      for (const f of FISH_TABLE) {
        expect(f.value, `fish ${f.id} has non-positive value`).toBeGreaterThan(0);
      }
    });

    it('every fish has valid rarity', () => {
      const validRarities = new Set(['common', 'uncommon', 'rare', 'legendary', 'exotic']);
      for (const f of FISH_TABLE) {
        expect(validRarities.has(f.rarity), `fish ${f.id} has unknown rarity '${f.rarity}'`).toBe(true);
      }
    });

    it('every fish with a zones array lists at least one zone', () => {
      for (const f of FISH_TABLE) {
        if (f.zones !== undefined) {
          expect(f.zones.length, `fish ${f.id} has empty zones array`).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('fishForZone', () => {
    it('returns a non-empty array for beach', () => {
      expect(fishForZone('beach').length).toBeGreaterThan(0);
    });

    it('returns a non-empty array for forest-river', () => {
      expect(fishForZone('forest-river').length).toBeGreaterThan(0);
    });

    it('all returned fish are from FISH_TABLE', () => {
      const ids = new Set(FISH_TABLE.map((f) => f.id));
      const result = fishForZone('beach');
      for (const f of result) {
        expect(ids.has(f.id)).toBe(true);
      }
    });
  });
});
