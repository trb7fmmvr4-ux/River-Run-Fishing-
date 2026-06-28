import { describe, it, expect } from 'vitest';
import { ENCOUNTERS } from './CombatData';

describe('CombatData', () => {
  it('has at least one encounter', () => {
    expect(Object.keys(ENCOUNTERS).length).toBeGreaterThan(0);
  });

  describe('beach-first-slime', () => {
    const enc = ENCOUNTERS['beach-first-slime'];

    it('exists', () => {
      expect(enc).toBeDefined();
    });

    it('id matches its key', () => {
      expect(enc.id).toBe('beach-first-slime');
    });

    it('has at least one enemy', () => {
      expect(enc.enemies.length).toBeGreaterThan(0);
    });

    it('all enemies have finite spawn offsets', () => {
      for (const e of enc.enemies) {
        expect(Number.isFinite(e.dx)).toBe(true);
        expect(Number.isFinite(e.dy)).toBe(true);
      }
    });

    it('has a hint message', () => {
      expect(enc.hintMessage).toBeTruthy();
    });

    it('hint duration is positive when set', () => {
      if (enc.hintDurationMs !== undefined) {
        expect(enc.hintDurationMs).toBeGreaterThan(0);
      }
    });
  });
});
