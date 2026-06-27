import { EventBus } from '../utils/EventBus';

export const StoryEvents = {
  /** Fired when a flag is set. Payload: flag id (string). */
  FLAG_SET: 'story-flag-set',
  /** Fired when a zone is unlocked. Payload: zone id (string). */
  ZONE_UNLOCKED: 'story-zone-unlocked',
  CHANGED: 'story-changed'
} as const;

/**
 * Tracks story/tutorial progress, unlocks, and rod progression.
 *
 * Deliberately generic: progress is a set of string "flags" (e.g.
 * 'intro_done', 'first_fish', 'first_slime', 'reached_village'), unlocks
 * are a set of zone ids, and rod tier is a small integer. This keeps the
 * narrative data-driven and lets future content add beats by inventing new
 * flag strings — no schema change. All state is plainly serializable.
 *
 * Known flag constants live here as a reference list, but any string is
 * valid so future systems aren't blocked on editing an enum.
 */
export const StoryFlags = {
  INTRO_STARTED: 'intro_started',
  MET_FISHERMAN: 'met_fisherman',
  RECEIVED_ROD: 'received_rod',
  FIRST_CAST: 'first_cast',
  FIRST_FISH: 'first_fish',
  TUTORIAL_DONE: 'tutorial_done',
  FIRST_SLIME: 'first_slime',
  REACHED_VILLAGE: 'reached_village',
  HINT_MOVE_SHOWN: 'hint_move_shown',
  HINT_INTERACT_SHOWN: 'hint_interact_shown'
} as const;

export interface StoryState {
  flags: string[];
  unlockedZones: string[];
  rodTier: number;
}

export class StoryProgress {
  private readonly flags = new Set<string>();
  private readonly unlockedZones = new Set<string>(['beach']); // beach always available
  private rodTier = 0;

  public has(flag: string): boolean {
    return this.flags.has(flag);
  }

  public setFlag(flag: string): void {
    if (this.flags.has(flag)) return;
    this.flags.add(flag);
    EventBus.emit(StoryEvents.FLAG_SET, flag);
    EventBus.emit(StoryEvents.CHANGED);
  }

  public isZoneUnlocked(zoneId: string): boolean {
    return this.unlockedZones.has(zoneId);
  }

  public unlockZone(zoneId: string): void {
    if (this.unlockedZones.has(zoneId)) return;
    this.unlockedZones.add(zoneId);
    EventBus.emit(StoryEvents.ZONE_UNLOCKED, zoneId);
    EventBus.emit(StoryEvents.CHANGED);
  }

  public get rod(): number {
    return this.rodTier;
  }

  public setRodTier(tier: number): void {
    if (tier <= this.rodTier) return;
    this.rodTier = tier;
    EventBus.emit(StoryEvents.CHANGED);
  }

  public toJSON(): StoryState {
    return {
      flags: [...this.flags],
      unlockedZones: [...this.unlockedZones],
      rodTier: this.rodTier
    };
  }

  public restore(state: Partial<StoryState> | undefined): void {
    if (!state) return;
    this.flags.clear();
    for (const f of state.flags ?? []) this.flags.add(f);
    this.unlockedZones.clear();
    this.unlockedZones.add('beach');
    for (const z of state.unlockedZones ?? []) this.unlockedZones.add(z);
    this.rodTier = state.rodTier ?? 0;
    EventBus.emit(StoryEvents.CHANGED);
  }
}
