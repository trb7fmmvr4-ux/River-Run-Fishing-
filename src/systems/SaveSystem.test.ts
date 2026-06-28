import { describe, it, expect, beforeEach, vi } from 'vitest';

// Phaser-dependent modules are mocked so SaveSystem's migration and
// capture logic can run in a pure Node environment.
vi.mock('../utils/EventBus', () => ({
  EventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  createBusSubscription: () => ({ on: vi.fn(), once: vi.fn(), dispose: vi.fn() })
}));
vi.mock('../systems/FishingSystem', () => ({
  FishingEvents: { CATCH_SUCCESS: 'fishing-catch-success', CAST: 'fishing-cast', CATCH_FAILURE: 'fishing-catch-failure', CANCELLED: 'fishing-cancelled' }
}));

import { SaveSystem } from './SaveSystem';
import type { SaveData } from './SaveSystem';

// Minimal in-memory localStorage stub.
function makeLocalStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; }
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorage());
});

// Minimal SaveableSystems stub with just gold + cooler (required fields).
function minimalSystems(gold = 0, capacity = 10) {
  return {
    gold:   { balance: gold, add: vi.fn(), spend: vi.fn() },
    cooler: {
      capacity,
      listFish: () => [] as { fishId: string; quantity: number }[],
      expandCapacity: vi.fn()
    }
  };
}

describe('SaveSystem', () => {
  describe('save / read round-trip', () => {
    it('returns null for an empty slot', () => {
      expect(SaveSystem.read(0)).toBeNull();
    });

    it('persists and retrieves gold', () => {
      const systems = minimalSystems(99);
      SaveSystem.save(0, systems);
      const data = SaveSystem.read(0);
      expect(data).not.toBeNull();
      expect(data!.gold).toBe(99);
    });

    it('persists and retrieves cooler capacity', () => {
      const systems = minimalSystems(0, 20);
      SaveSystem.save(0, systems);
      expect(SaveSystem.read(0)!.coolerCapacity).toBe(20);
    });

    it('save() returns true on success', () => {
      expect(SaveSystem.save(0, minimalSystems())).toBe(true);
    });

    it('read() returns null for corrupt JSON', () => {
      localStorage.setItem('river-run-fishing:save:v1:slot0', 'not-json');
      expect(SaveSystem.read(0)).toBeNull();
    });

    it('read() returns null when gold field is missing', () => {
      localStorage.setItem('river-run-fishing:save:v1:slot0', JSON.stringify({ version: 1, savedAt: 0 }));
      expect(SaveSystem.read(0)).toBeNull();
    });
  });

  describe('version handling in read()', () => {
    it('accepts a save at the current version', () => {
      const systems = minimalSystems(5);
      SaveSystem.save(0, systems);
      expect(SaveSystem.read(0)).not.toBeNull();
    });

    it('rejects a save from a future version', () => {
      const future: Partial<SaveData> = { version: 9999, savedAt: 0, gold: 10, coolerCapacity: 10, cooler: [] };
      localStorage.setItem('river-run-fishing:save:v1:slot0', JSON.stringify(future));
      expect(SaveSystem.read(0)).toBeNull();
    });

    it('accepts a save with no version field (treated as v1)', () => {
      const old: Partial<SaveData> = { savedAt: 0, gold: 7, coolerCapacity: 10, cooler: [] };
      localStorage.setItem('river-run-fishing:save:v1:slot0', JSON.stringify(old));
      const data = SaveSystem.read(0);
      expect(data).not.toBeNull();
      expect(data!.gold).toBe(7);
    });
  });

  describe('lastSlot', () => {
    it('returns null before any save', () => {
      expect(SaveSystem.lastSlot()).toBeNull();
    });

    it('returns the slot of the most recent save', () => {
      SaveSystem.save(2, minimalSystems());
      expect(SaveSystem.lastSlot()).toBe(2);
    });
  });

  describe('hasAnySave', () => {
    it('returns false when no slots are written', () => {
      expect(SaveSystem.hasAnySave()).toBe(false);
    });

    it('returns true after a save', () => {
      SaveSystem.save(1, minimalSystems());
      expect(SaveSystem.hasAnySave()).toBe(true);
    });
  });

  describe('clear', () => {
    it('removes a slot so read() returns null', () => {
      SaveSystem.save(0, minimalSystems(42));
      SaveSystem.clear(0);
      expect(SaveSystem.read(0)).toBeNull();
    });
  });

  describe('listSlots', () => {
    it('returns SLOT_COUNT entries', () => {
      expect(SaveSystem.listSlots().length).toBe(SaveSystem.SLOT_COUNT);
    });

    it('marks empty slots as not existing', () => {
      const slots = SaveSystem.listSlots();
      expect(slots.every((s) => !s.exists)).toBe(true);
    });

    it('marks a written slot as existing with correct gold', () => {
      SaveSystem.save(1, minimalSystems(55));
      const slot = SaveSystem.listSlots().find((s) => s.slot === 1);
      expect(slot!.exists).toBe(true);
      expect(slot!.gold).toBe(55);
    });
  });

  describe('capture', () => {
    it('snapshot includes version and savedAt timestamp', () => {
      const snap = SaveSystem.capture(minimalSystems(10));
      expect(typeof snap.version).toBe('number');
      expect(typeof snap.savedAt).toBe('number');
      expect(snap.savedAt).toBeGreaterThan(0);
    });

    it('snapshot gold matches systems gold', () => {
      const snap = SaveSystem.capture(minimalSystems(77));
      expect(snap.gold).toBe(77);
    });
  });
});
