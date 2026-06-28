import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/EventBus', () => ({
  EventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  createBusSubscription: () => ({ on: vi.fn(), once: vi.fn(), dispose: vi.fn() })
}));

import { StoryProgress, StoryFlags } from './StoryProgress';
import { EventBus } from '../utils/EventBus';

const mockEmit = vi.mocked(EventBus.emit);

beforeEach(() => {
  mockEmit.mockClear();
});

describe('StoryProgress', () => {
  describe('flags', () => {
    it('has() returns false for unset flag', () => {
      const s = new StoryProgress();
      expect(s.has(StoryFlags.FIRST_FISH)).toBe(false);
    });

    it('setFlag() makes has() return true', () => {
      const s = new StoryProgress();
      s.setFlag(StoryFlags.FIRST_FISH);
      expect(s.has(StoryFlags.FIRST_FISH)).toBe(true);
    });

    it('setFlag() emits FLAG_SET event', () => {
      const s = new StoryProgress();
      s.setFlag(StoryFlags.FIRST_FISH);
      const emittedEvents = mockEmit.mock.calls.map((c) => c[0]);
      expect(emittedEvents).toContain('story-flag-set');
    });

    it('setting the same flag twice only emits once', () => {
      const s = new StoryProgress();
      s.setFlag(StoryFlags.TUTORIAL_DONE);
      s.setFlag(StoryFlags.TUTORIAL_DONE);
      const flagEvents = mockEmit.mock.calls.filter((c) => c[0] === 'story-flag-set');
      expect(flagEvents.length).toBe(1);
    });

    it('accepts arbitrary string flags (not just StoryFlags constants)', () => {
      const s = new StoryProgress();
      s.setFlag('custom_flag_xyz');
      expect(s.has('custom_flag_xyz')).toBe(true);
    });
  });

  describe('zone unlocks', () => {
    it('beach is unlocked by default', () => {
      const s = new StoryProgress();
      expect(s.isZoneUnlocked('beach')).toBe(true);
    });

    it('forest-river is locked by default', () => {
      const s = new StoryProgress();
      expect(s.isZoneUnlocked('forest-river')).toBe(false);
    });

    it('unlockZone() makes isZoneUnlocked() return true', () => {
      const s = new StoryProgress();
      s.unlockZone('forest-river');
      expect(s.isZoneUnlocked('forest-river')).toBe(true);
    });

    it('unlockZone() emits ZONE_UNLOCKED event', () => {
      const s = new StoryProgress();
      s.unlockZone('forest-river');
      const emittedEvents = mockEmit.mock.calls.map((c) => c[0]);
      expect(emittedEvents).toContain('story-zone-unlocked');
    });

    it('unlocking same zone twice only emits once', () => {
      const s = new StoryProgress();
      s.unlockZone('forest-river');
      s.unlockZone('forest-river');
      const zoneEvents = mockEmit.mock.calls.filter((c) => c[0] === 'story-zone-unlocked');
      expect(zoneEvents.length).toBe(1);
    });
  });

  describe('rod tier', () => {
    it('rod starts at 0', () => {
      const s = new StoryProgress();
      expect(s.rod).toBe(0);
    });

    it('setRodTier() advances the tier', () => {
      const s = new StoryProgress();
      s.setRodTier(2);
      expect(s.rod).toBe(2);
    });

    it('setRodTier() does not downgrade', () => {
      const s = new StoryProgress();
      s.setRodTier(3);
      s.setRodTier(1);
      expect(s.rod).toBe(3);
    });
  });

  describe('toJSON / restore', () => {
    it('toJSON captures flags, zones, and rod tier', () => {
      const s = new StoryProgress();
      s.setFlag(StoryFlags.FIRST_FISH);
      s.unlockZone('forest-river');
      s.setRodTier(2);
      const snap = s.toJSON();
      expect(snap.flags).toContain(StoryFlags.FIRST_FISH);
      expect(snap.unlockedZones).toContain('forest-river');
      expect(snap.unlockedZones).toContain('beach');
      expect(snap.rodTier).toBe(2);
    });

    it('round-trips through toJSON/restore', () => {
      const s = new StoryProgress();
      s.setFlag(StoryFlags.REACHED_VILLAGE);
      s.unlockZone('forest-river');
      s.setRodTier(1);
      const snap = s.toJSON();

      const s2 = new StoryProgress();
      s2.restore(snap);
      expect(s2.has(StoryFlags.REACHED_VILLAGE)).toBe(true);
      expect(s2.isZoneUnlocked('forest-river')).toBe(true);
      expect(s2.rod).toBe(1);
    });

    it('restore always keeps beach unlocked', () => {
      const s = new StoryProgress();
      s.restore({ flags: [], unlockedZones: [], rodTier: 0 });
      expect(s.isZoneUnlocked('beach')).toBe(true);
    });

    it('restore is safe with undefined', () => {
      const s = new StoryProgress();
      s.restore(undefined);
      expect(s.rod).toBe(0);
      expect(s.isZoneUnlocked('beach')).toBe(true);
    });
  });
});
