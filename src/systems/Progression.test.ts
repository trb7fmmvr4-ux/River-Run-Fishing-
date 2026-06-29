import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted() runs before vi.mock() hoisting, so this registry is available
// inside the mock factory. It lets the test fire real CATCH_SUCCESS /
// ENEMY_DEFEATED events through the bus the way the game does, which is the
// only way to meaningfully exercise the setRestoring guard.
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
  FishingEvents: { CATCH_SUCCESS: 'fishing-catch-success', CAST: 'fishing-cast', CATCH_FAILURE: 'fishing-catch-failure', CANCELLED: 'fishing-cancelled' }
}));
vi.mock('./CombatSystem', () => ({
  CombatEvents: { ENEMY_DEFEATED: 'combat-enemy-defeated', ENCOUNTER_CLEARED: 'combat-encounter-cleared', PLAYER_ATTACK: 'combat-player-attack', PLAYER_HURT: 'combat-player-hurt' }
}));

import { Progression } from './Progression';
import { EventBus } from '../utils/EventBus';

const mockEmit = vi.mocked(EventBus.emit);

// onCatch only reads fish.rarity; a minimal stand-in is enough.
function fireCatch(rarity = 'common') {
  eventRegistry.fire('fishing-catch-success', { rarity });
}
function fireEnemyDefeated() {
  eventRegistry.fire('combat-enemy-defeated');
}

beforeEach(() => {
  eventRegistry.clear();
  mockEmit.mockClear();
});

describe('Progression', () => {
  describe('gainXp', () => {
    it('starts every skill at level 1, xp 0', () => {
      const p = new Progression();
      expect(p.level('fishing')).toBe(1);
      expect(p.xpInLevel('fishing')).toBe(0);
    });

    it('accumulates xp within the level', () => {
      const p = new Progression();
      p.gainXp('fishing', 10);
      expect(p.xpInLevel('fishing')).toBe(10);
      expect(p.level('fishing')).toBe(1);
    });

    it('levels up when xp meets the threshold', () => {
      const p = new Progression();
      // Level 1→2 requires round(50 * 1^1.5) = 50 xp
      p.gainXp('fishing', 50);
      expect(p.level('fishing')).toBe(2);
      expect(p.xpInLevel('fishing')).toBe(0);
    });

    it('carries leftover xp into the new level', () => {
      const p = new Progression();
      p.gainXp('fishing', 60); // 50 to level, 10 left over
      expect(p.level('fishing')).toBe(2);
      expect(p.xpInLevel('fishing')).toBe(10);
    });

    it('emits LEVEL_UP when levelling', () => {
      const p = new Progression();
      p.gainXp('fishing', 50);
      const calls = mockEmit.mock.calls.map((c) => c[0]);
      expect(calls).toContain('progression-levelup');
    });

    it('handles multi-level-up in one gainXp call', () => {
      const p = new Progression();
      // L1→2: 50, L2→3: round(50*2^1.5)≈141, total ~191
      p.gainXp('fishing', 200);
      expect(p.level('fishing')).toBeGreaterThanOrEqual(3);
    });

    it('ignores zero or negative xp', () => {
      const p = new Progression();
      p.gainXp('fishing', 0);
      p.gainXp('fishing', -10);
      expect(p.xpInLevel('fishing')).toBe(0);
    });

    it('each skill is independent', () => {
      const p = new Progression();
      p.gainXp('combat', 50);
      expect(p.level('combat')).toBe(2);
      expect(p.level('fishing')).toBe(1);
      expect(p.level('crafting')).toBe(1);
    });
  });

  describe('event-driven xp', () => {
    it('awards fishing xp on CATCH_SUCCESS, scaled by rarity', () => {
      const p = new Progression();
      fireCatch('common'); // 5 xp
      expect(p.xpInLevel('fishing')).toBe(5);
      fireCatch('rare'); // +30 xp
      expect(p.xpInLevel('fishing')).toBe(35);
    });

    it('awards combat xp on ENEMY_DEFEATED', () => {
      const p = new Progression();
      fireEnemyDefeated(); // 8 xp
      expect(p.xpInLevel('combat')).toBe(8);
    });
  });

  describe('setRestoring', () => {
    it('suppresses event-driven xp while restoring is active', () => {
      const p = new Progression();
      p.setRestoring(true);
      fireCatch('common');
      fireEnemyDefeated();
      expect(p.xpInLevel('fishing')).toBe(0);
      expect(p.xpInLevel('combat')).toBe(0);
    });

    it('resumes event-driven xp once restoring is turned off', () => {
      const p = new Progression();
      p.setRestoring(true);
      fireCatch('common');
      p.setRestoring(false);
      fireCatch('common');
      expect(p.xpInLevel('fishing')).toBe(5); // only the post-restore catch
    });

    it('does not block explicit gainXp (restore applies levels directly)', () => {
      const p = new Progression();
      p.setRestoring(true);
      p.gainXp('fishing', 10);
      expect(p.xpInLevel('fishing')).toBe(10);
    });
  });

  describe('levelProgress', () => {
    it('returns 0 at the start of a level', () => {
      const p = new Progression();
      expect(p.levelProgress('fishing')).toBe(0);
    });

    it('returns a value between 0 and 1 with partial xp', () => {
      const p = new Progression();
      p.gainXp('fishing', 25); // half of 50
      expect(p.levelProgress('fishing')).toBeCloseTo(0.5);
    });
  });

  describe('totalLevel', () => {
    it('sums all skill levels', () => {
      const p = new Progression();
      expect(p.totalLevel).toBe(3); // 1+1+1
      p.gainXp('fishing', 50);
      expect(p.totalLevel).toBe(4); // 2+1+1
    });
  });

  describe('toJSON / restore', () => {
    it('toJSON returns a plain snapshot', () => {
      const p = new Progression();
      p.gainXp('fishing', 30);
      p.gainXp('combat', 8);
      const snap = p.toJSON();
      expect(snap.fishing.xp).toBe(30);
      expect(snap.combat.xp).toBe(8);
      expect(snap.crafting.level).toBe(1);
    });

    it('toJSON is a deep copy, not a live reference', () => {
      const p = new Progression();
      const snap = p.toJSON();
      p.gainXp('fishing', 10);
      expect(snap.fishing.xp).toBe(0); // snapshot unchanged
    });

    it('restore applies saved levels and xp', () => {
      const p = new Progression();
      p.restore({ fishing: { level: 5, xp: 20 }, combat: { level: 3, xp: 0 }, crafting: { level: 1, xp: 0 } });
      expect(p.level('fishing')).toBe(5);
      expect(p.xpInLevel('fishing')).toBe(20);
      expect(p.level('combat')).toBe(3);
    });

    it('round-trips through toJSON/restore', () => {
      const p = new Progression();
      p.gainXp('fishing', 30);
      p.gainXp('combat', 8);
      const snap = p.toJSON();

      const p2 = new Progression();
      p2.restore(snap);
      expect(p2.toJSON()).toEqual(snap);
    });

    it('restore is a no-op for undefined state', () => {
      const p = new Progression();
      p.restore(undefined);
      expect(p.level('fishing')).toBe(1);
    });

    it('restore ignores missing skill keys', () => {
      const p = new Progression();
      p.restore({ fishing: { level: 3, xp: 10 } });
      expect(p.level('fishing')).toBe(3);
      expect(p.level('combat')).toBe(1); // unchanged
    });

    it('restore defaults missing xp to 0', () => {
      const p = new Progression();
      p.restore({ fishing: { level: 4 } as { level: number; xp: number } });
      expect(p.level('fishing')).toBe(4);
      expect(p.xpInLevel('fishing')).toBe(0);
    });
  });
});
