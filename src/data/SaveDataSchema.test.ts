import { describe, it, expect } from 'vitest';
import {
  isValidRawSave,
  isValidCoolerEntry,
  isValidStoryBlock,
  isValidProgressionBlock,
  auditRawSave
} from './SaveDataSchema';

describe('isValidRawSave', () => {
  it('accepts a minimal valid save', () => {
    expect(isValidRawSave({ gold: 0, coolerCapacity: 10, cooler: [] })).toBe(true);
  });
  it('rejects null', () => { expect(isValidRawSave(null)).toBe(false); });
  it('rejects missing gold', () => { expect(isValidRawSave({ coolerCapacity: 10, cooler: [] })).toBe(false); });
  it('rejects string gold', () => { expect(isValidRawSave({ gold: '100', coolerCapacity: 10, cooler: [] })).toBe(false); });
  it('rejects missing cooler', () => { expect(isValidRawSave({ gold: 0, coolerCapacity: 10 })).toBe(false); });
  it('rejects non-array cooler', () => { expect(isValidRawSave({ gold: 0, coolerCapacity: 10, cooler: {} })).toBe(false); });
});

describe('isValidCoolerEntry', () => {
  it('accepts a valid entry', () => {
    expect(isValidCoolerEntry({ fishId: 'perch', quantity: 2 })).toBe(true);
  });
  it('rejects quantity 0', () => {
    expect(isValidCoolerEntry({ fishId: 'perch', quantity: 0 })).toBe(false);
  });
  it('rejects missing fishId', () => {
    expect(isValidCoolerEntry({ quantity: 1 })).toBe(false);
  });
  it('rejects non-object', () => {
    expect(isValidCoolerEntry('perch')).toBe(false);
  });
});

describe('isValidStoryBlock', () => {
  const valid = { flags: ['intro_done'], unlockedZones: ['beach'], rodTier: 1 };
  it('accepts a valid story block', () => { expect(isValidStoryBlock(valid)).toBe(true); });
  it('rejects missing rodTier', () => {
    expect(isValidStoryBlock({ flags: [], unlockedZones: [] })).toBe(false);
  });
  it('rejects non-string flags', () => {
    expect(isValidStoryBlock({ flags: [1, 2], unlockedZones: [], rodTier: 0 })).toBe(false);
  });
});

describe('isValidProgressionBlock', () => {
  const valid = {
    fishing: { level: 1, xp: 0 },
    combat: { level: 1, xp: 0 },
    crafting: { level: 1, xp: 0 }
  };
  it('accepts a valid progression block', () => { expect(isValidProgressionBlock(valid)).toBe(true); });
  it('rejects missing skill', () => {
    expect(isValidProgressionBlock({ fishing: { level: 1, xp: 0 }, combat: { level: 1, xp: 0 } })).toBe(false);
  });
  it('rejects string level', () => {
    expect(isValidProgressionBlock({ ...valid, fishing: { level: '1', xp: 0 } })).toBe(false);
  });
});

describe('auditRawSave', () => {
  const minimal = { gold: 50, coolerCapacity: 10, cooler: [] };

  it('returns null for a valid minimal save', () => {
    expect(auditRawSave(minimal)).toBeNull();
  });

  it('reports reason for non-object input', () => {
    expect(auditRawSave(null)).toBe('not an object');
    expect(auditRawSave('save')).toBe('not an object');
  });

  it('reports reason for negative gold', () => {
    expect(auditRawSave({ ...minimal, gold: -1 })).toBe('gold is negative');
  });

  it('reports reason for invalid coolerCapacity', () => {
    expect(auditRawSave({ ...minimal, coolerCapacity: 0 })).toBe('coolerCapacity invalid');
    expect(auditRawSave({ ...minimal, coolerCapacity: 'big' })).toBe('coolerCapacity invalid');
  });

  it('reports reason for malformed cooler entry', () => {
    expect(auditRawSave({ ...minimal, cooler: [{ fishId: 'perch', quantity: 0 }] }))
      .toBe('cooler[0] is malformed');
  });

  it('reports reason for malformed story block', () => {
    expect(auditRawSave({ ...minimal, story: { flags: 'bad', unlockedZones: [], rodTier: 0 } }))
      .toBe('story block is malformed');
  });

  it('accepts save with valid optional fields', () => {
    expect(auditRawSave({
      ...minimal,
      cooler: [{ fishId: 'perch', quantity: 3 }],
      story: { flags: ['intro_done'], unlockedZones: ['beach'], rodTier: 1 },
      progression: {
        fishing: { level: 2, xp: 10 },
        combat: { level: 1, xp: 0 },
        crafting: { level: 1, xp: 0 }
      }
    })).toBeNull();
  });
});
