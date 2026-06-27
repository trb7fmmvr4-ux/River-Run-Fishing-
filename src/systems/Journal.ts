import { EventBus } from '../utils/EventBus';
import { FISH_TABLE, rollFishMeasurements, type FishDefinition } from '../data/FishData';
import { FishingEvents } from './FishingSystem';

export const JournalEvents = {
  /** Fired the first time a given species is ever caught. Payload: FishDefinition. */
  DISCOVERED: 'journal-discovered',
  /** Fired on every catch with the rolled record. Payload: { fish, weightKg, lengthCm, isRecord }. */
  RECORDED: 'journal-recorded',
  /** Fired whenever the journal changes (discovery, catch, or load). */
  CHANGED: 'journal-changed'
} as const;

export interface JournalRecord {
  fishId: string;
  timesCaught: number;
  largestWeightKg: number;
  largestLengthCm: number;
  firstCaughtAt: number;
  /**
   * Conditions when this species was first discovered (all optional /
   * additive — older saves simply lack them). Captured from the discovery
   * context provider at first catch and never overwritten afterward.
   */
  zoneDiscovered?: string;
  timeDiscovered?: string;
  weatherDiscovered?: string;
}

/** Context supplied at catch time for richer discovery records. */
export interface JournalCatchContext {
  zoneId?: string;
  time?: string;
  weather?: string;
}

/**
 * The fish journal: tracks discovery AND per-species records (times caught,
 * largest weight, largest length).
 *
 * Still listens to the existing CATCH_SUCCESS event (no change to
 * FishingSystem). On each catch it rolls concrete measurements via
 * FishData.rollFishMeasurements and folds them into that species' record,
 * keeping the running maxima. Serialization is backward-compatible: it can
 * load an old save that stored a plain id array, and writes the richer
 * record map going forward.
 */
export class Journal {
  private readonly records = new Map<string, JournalRecord>();
  /**
   * When true, catch events are ignored. The save system sets this around
   * restoration, because restoring the cooler re-emits CATCH_SUCCESS for
   * every stored fish — without this guard those synthetic catches would
   * inflate catch counts and fire spurious "new record" toasts on every
   * load. Restored records are applied explicitly via restore().
   */
  private restoring = false;
  /** Optional source of catch conditions (zone/time/weather) for records. */
  private contextProvider?: () => JournalCatchContext;

  constructor() {
    EventBus.on(FishingEvents.CATCH_SUCCESS, this.onCatch, this);
  }

  /** Wire a discovery-context source. Optional + additive. */
  public setContextProvider(provider: () => JournalCatchContext): void {
    this.contextProvider = provider;
  }

  /** Toggle restore mode (suspends event-driven recording). Used by SaveSystem. */
  public setRestoring(value: boolean): void {
    this.restoring = value;
  }

  private onCatch(fish: FishDefinition): void {
    if (this.restoring) return;
    const isNew = !this.records.has(fish.id);
    const { weightKg, lengthCm } = rollFishMeasurements(fish);

    const rec = this.records.get(fish.id) ?? {
      fishId: fish.id,
      timesCaught: 0,
      largestWeightKg: 0,
      largestLengthCm: 0,
      firstCaughtAt: Date.now()
    };
    rec.timesCaught += 1;

    // Capture discovery conditions once, on first catch only.
    if (isNew) {
      const ctx = this.contextProvider?.();
      if (ctx) {
        rec.zoneDiscovered = ctx.zoneId;
        rec.timeDiscovered = ctx.time;
        rec.weatherDiscovered = ctx.weather;
      }
    }

    const beatWeight = weightKg > rec.largestWeightKg;
    const beatLength = lengthCm > rec.largestLengthCm;
    rec.largestWeightKg = Math.max(rec.largestWeightKg, weightKg);
    rec.largestLengthCm = Math.max(rec.largestLengthCm, lengthCm);
    this.records.set(fish.id, rec);

    if (isNew) EventBus.emit(JournalEvents.DISCOVERED, fish);
    EventBus.emit(JournalEvents.RECORDED, {
      fish,
      weightKg,
      lengthCm,
      isRecord: isNew || beatWeight || beatLength
    });
    EventBus.emit(JournalEvents.CHANGED);
  }

  public has(fishId: string): boolean {
    return this.records.has(fishId);
  }

  public record(fishId: string): JournalRecord | undefined {
    return this.records.get(fishId);
  }

  public get discoveredCount(): number {
    return this.records.size;
  }

  public get totalSpecies(): number {
    return FISH_TABLE.length;
  }

  public get totalCatches(): number {
    let n = 0;
    for (const r of this.records.values()) n += r.timesCaught;
    return n;
  }

  /** 0..1 completion across all known species. */
  public get completion(): number {
    return this.totalSpecies === 0 ? 0 : this.discoveredCount / this.totalSpecies;
  }

  /**
   * Overall completion statistics for the journal UI / feedback. Derived
   * from the record set + FISH_TABLE, so new fish integrate automatically.
   */
  public stats(): {
    discovered: number;
    totalSpecies: number;
    totalCatches: number;
    completionPct: number;
    legendaryDiscovered: number;
    legendaryTotal: number;
  } {
    const legendaryTotal = FISH_TABLE.filter((f) => f.rarity === 'legendary').length;
    let legendaryDiscovered = 0;
    for (const f of FISH_TABLE) {
      if (f.rarity === 'legendary' && this.records.has(f.id)) legendaryDiscovered += 1;
    }
    return {
      discovered: this.discoveredCount,
      totalSpecies: this.totalSpecies,
      totalCatches: this.totalCatches,
      completionPct: Math.round(this.completion * 100),
      legendaryDiscovered,
      legendaryTotal
    };
  }

  /** Full record list (for the journal UI), in FISH_TABLE order. */
  public allRecords(): { fish: FishDefinition; record?: JournalRecord }[] {
    return FISH_TABLE.map((fish) => ({ fish, record: this.records.get(fish.id) }));
  }

  /** Serialize: array of records. */
  public toJSON(): JournalRecord[] {
    return [...this.records.values()];
  }

  /**
   * Restore from save. Accepts both the new record array and the legacy
   * plain id-string array (older saves), so existing saves keep loading.
   */
  public restore(data: JournalRecord[] | string[]): void {
    this.records.clear();
    for (const entry of data) {
      if (typeof entry === 'string') {
        this.records.set(entry, {
          fishId: entry,
          timesCaught: 1,
          largestWeightKg: 0,
          largestLengthCm: 0,
          firstCaughtAt: Date.now()
        });
      } else if (entry && typeof entry === 'object' && 'fishId' in entry) {
        this.records.set(entry.fishId, entry);
      }
    }
    EventBus.emit(JournalEvents.CHANGED);
  }

  public destroy(): void {
    EventBus.off(FishingEvents.CATCH_SUCCESS, this.onCatch, this);
  }
}
