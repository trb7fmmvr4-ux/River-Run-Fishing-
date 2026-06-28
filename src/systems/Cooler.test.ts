import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted() runs before vi.mock() hoisting, so variables defined here
// are available inside the mock factory below.
const eventRegistry = vi.hoisted(() => {
  type Listener = [fn: (...args: unknown[]) => void, ctx: unknown];
  const registry = new Map<string, Listener[]>();
  return {
    fire: (event: string, ...args: unknown[]) => {
      (registry.get(event) ?? []).forEach(([fn, ctx]) => fn.apply(ctx, args));
    },
    register: (event: string, fn: (...args: unknown[]) => void, ctx: unknown) => {
      const bucket = registry.get(event) ?? [];
      registry.set(event, [...bucket, [fn, ctx]]);
    },
    clear: () => registry.clear()
  };
});

vi.mock('../utils/EventBus', () => ({
  EventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  createBusSubscription: () => ({
    on: (event: string, fn: (...args: unknown[]) => void, ctx: unknown) =>
      eventRegistry.register(event, fn, ctx),
    dispose: vi.fn()
  })
}));
vi.mock('./FishingSystem', () => ({
  FishingEvents: {
    CATCH_SUCCESS: 'fishing-catch-success',
    CAST: 'fishing-cast',
    CATCH_FAILURE: 'fishing-catch-failure',
    CANCELLED: 'fishing-cancelled'
  }
}));

import { Cooler } from './Cooler';
import { FISH_TABLE } from '../data/FishData';
import { EventBus } from '../utils/EventBus';

const mockEmit = vi.mocked(EventBus.emit);

// Grab real fish entries from the table for realistic test data.
const bass   = FISH_TABLE.find((f) => f.id === 'perch') ?? FISH_TABLE[0];
const salmon = FISH_TABLE.find((f) => f.id === 'salmon') ?? FISH_TABLE[1];

function fireCatch(fish: typeof bass) {
  eventRegistry.fire('fishing-catch-success', fish);
}

beforeEach(() => {
  eventRegistry.clear();
  mockEmit.mockClear();
});

describe('Cooler', () => {
  describe('initial state', () => {
    it('starts empty', () => {
      const c = new Cooler(10);
      expect(c.count).toBe(0);
      expect(c.isFull).toBe(false);
    });

    it('reports the configured capacity', () => {
      const c = new Cooler(5);
      expect(c.capacity).toBe(5);
    });

    it('listFish returns an empty array', () => {
      const c = new Cooler(10);
      expect(c.listFish()).toEqual([]);
    });
  });

  describe('adding fish via CATCH_SUCCESS', () => {
    it('increases count by 1 on each catch', () => {
      const c = new Cooler(10);
      fireCatch(bass);
      expect(c.count).toBe(1);
    });

    it('stacks the same fish species into one entry', () => {
      const c = new Cooler(10);
      fireCatch(bass);
      fireCatch(bass);
      const stacks = c.listFish();
      expect(stacks.length).toBe(1);
      expect(stacks[0].quantity).toBe(2);
    });

    it('lists different species as separate stacks', () => {
      const c = new Cooler(10);
      fireCatch(bass);
      fireCatch(salmon);
      expect(c.listFish().length).toBe(2);
    });

    it('emits CoolerEvents.CHANGED on a successful catch', () => {
      const c = new Cooler(10);
      fireCatch(bass);
      const events = mockEmit.mock.calls.map((c) => c[0]);
      expect(events).toContain('cooler-changed');
    });
  });

  describe('capacity enforcement', () => {
    it('is full when count reaches capacity', () => {
      const c = new Cooler(2);
      fireCatch(bass);
      fireCatch(salmon);
      expect(c.isFull).toBe(true);
    });

    it('emits FULL instead of CHANGED when capacity is reached', () => {
      const c = new Cooler(1);
      fireCatch(bass);           // fills the cooler
      mockEmit.mockClear();
      fireCatch(salmon);         // should bounce
      const events = mockEmit.mock.calls.map((c) => c[0]);
      expect(events).toContain('cooler-full');
      expect(events).not.toContain('cooler-changed');
    });

    it('does not add fish when full', () => {
      const c = new Cooler(1);
      fireCatch(bass);
      fireCatch(salmon);         // bounced
      expect(c.count).toBe(1);
    });

    it('expandCapacity increases the limit', () => {
      const c = new Cooler(1);
      fireCatch(bass);
      expect(c.isFull).toBe(true);
      c.expandCapacity(1);
      expect(c.isFull).toBe(false);
      fireCatch(salmon);
      expect(c.count).toBe(2);
    });
  });

  describe('removeFish', () => {
    it('returns null for a fish not in the cooler', () => {
      const c = new Cooler(10);
      expect(c.removeFish(bass.id)).toBeNull();
    });

    it('returns the fish value when removal succeeds', () => {
      const c = new Cooler(10);
      fireCatch(bass);
      const value = c.removeFish(bass.id);
      expect(value).toBe(bass.value);
    });

    it('decrements count after removal', () => {
      const c = new Cooler(10);
      fireCatch(bass);
      fireCatch(bass);
      c.removeFish(bass.id);
      expect(c.count).toBe(1);
    });
  });

  describe('removeAllFish', () => {
    it('returns 0 for an empty cooler', () => {
      const c = new Cooler(10);
      expect(c.removeAllFish()).toBe(0);
    });

    it('returns the total gold value of all stored fish', () => {
      const c = new Cooler(10);
      fireCatch(bass);
      fireCatch(bass);
      fireCatch(salmon);
      const expected = bass.value * 2 + salmon.value;
      expect(c.removeAllFish()).toBe(expected);
    });

    it('empties the cooler after removal', () => {
      const c = new Cooler(10);
      fireCatch(bass);
      c.removeAllFish();
      expect(c.count).toBe(0);
      expect(c.listFish()).toEqual([]);
    });
  });
});
