import { describe, it, expect } from 'vitest';
import { canonicalZoneId, getZoneDefinition, STARTING_ZONE_ID } from './ZoneData';

describe('ZoneData', () => {
  describe('canonicalZoneId', () => {
    it('passes through canonical ids unchanged', () => {
      expect(canonicalZoneId('beach')).toBe('beach');
      expect(canonicalZoneId('forest-river')).toBe('forest-river');
    });

    it('resolves the legacy "river" alias to "forest-river"', () => {
      expect(canonicalZoneId('river')).toBe('forest-river');
    });

    it('is idempotent', () => {
      expect(canonicalZoneId(canonicalZoneId('river'))).toBe('forest-river');
    });
  });

  describe('getZoneDefinition', () => {
    it('returns a definition for beach', () => {
      const def = getZoneDefinition('beach');
      expect(def).toBeDefined();
      expect(def.id).toBe('beach');
    });

    it('returns a definition for forest-river', () => {
      const def = getZoneDefinition('forest-river');
      expect(def).toBeDefined();
      expect(def.id).toBe('forest-river');
    });

    it('resolves the legacy "river" alias', () => {
      const def = getZoneDefinition('river');
      expect(def.id).toBe('forest-river');
    });

    it('all active zone definitions have positive tile dimensions', () => {
      for (const id of ['beach', 'forest-river'] as const) {
        const def = getZoneDefinition(id);
        expect(def.widthInTiles, `${id} has non-positive width`).toBeGreaterThan(0);
        expect(def.heightInTiles, `${id} has non-positive height`).toBeGreaterThan(0);
      }
    });
  });

  describe('zone connections', () => {
    it('beach has a right-edge connection to forest-river', () => {
      const def = getZoneDefinition('beach');
      expect(def.connections).toBeDefined();
      const conn = def.connections!.find((c) => c.edge === 'right');
      expect(conn).toBeDefined();
      expect(conn!.toZone).toBe('forest-river');
    });

    it('forest-river has a left-edge connection back to beach', () => {
      const def = getZoneDefinition('forest-river');
      expect(def.connections).toBeDefined();
      const conn = def.connections!.find((c) => c.edge === 'left');
      expect(conn).toBeDefined();
      expect(conn!.toZone).toBe('beach');
    });

    it('beach connection requires forest-river to be unlocked', () => {
      const conn = getZoneDefinition('beach').connections!.find((c) => c.toZone === 'forest-river');
      expect(conn!.requiresUnlock).toBe('forest-river');
    });

    it('forest-river return connection has no unlock requirement', () => {
      const conn = getZoneDefinition('forest-river').connections!.find((c) => c.toZone === 'beach');
      expect(conn!.requiresUnlock).toBeUndefined();
    });
  });

  describe('STARTING_ZONE_ID', () => {
    it('is a resolvable zone', () => {
      const def = getZoneDefinition(STARTING_ZONE_ID);
      expect(def).toBeDefined();
      expect(def.id).toBe(STARTING_ZONE_ID);
    });
  });
});
