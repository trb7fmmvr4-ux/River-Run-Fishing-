/**
 * Persistent game settings (audio, graphics, gameplay).
 *
 * A tiny, dependency-free store backed by localStorage and versioned so
 * future fields can be added without breaking existing saved settings
 * (unknown/missing fields fall back to defaults via the merge in `load`).
 * Built to be the single place settings live, so any system (sound,
 * scaling, future gameplay toggles) can read/update them consistently.
 */

export interface GameSettings {
  version: number;
  audio: {
    master: number; // 0..1
    music: number; // 0..1
    sfx: number; // 0..1
  };
  graphics: {
    fullscreen: boolean;
    /** Reserved for future resolution scaling; 1 = native. */
    renderScale: number;
  };
  gameplay: {
    /** Placeholder section for future gameplay toggles. */
    reserved: boolean;
  };
}

const STORAGE_KEY = 'river-run-fishing:settings:v1';
const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: GameSettings = {
  version: SETTINGS_VERSION,
  audio: { master: 0.8, music: 0.7, sfx: 0.9 },
  graphics: { fullscreen: false, renderScale: 1 },
  gameplay: { reserved: true }
};

function deepMerge<T>(base: T, override: Partial<T> | undefined): T {
  if (!override) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const ov = (override as any)[key];
    const bv = (base as any)[key];
    if (ov && typeof ov === 'object' && bv && typeof bv === 'object' && !Array.isArray(ov)) {
      out[key] = deepMerge(bv, ov);
    } else if (ov !== undefined) {
      out[key] = ov;
    }
  }
  return out;
}

export const SettingsStore = {
  /** Load saved settings, merged over defaults so missing fields are safe. */
  load(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return deepMerge(DEFAULT_SETTINGS, parsed);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  /** Persist settings. Returns false if storage is unavailable. */
  save(settings: GameSettings): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
      return true;
    } catch {
      return false;
    }
  },

  /** Convenience: update part of the settings and persist in one call. */
  update(patch: Partial<GameSettings>): GameSettings {
    const next = deepMerge(this.load(), patch);
    this.save(next);
    return next;
  }
};
