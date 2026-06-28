import { EventBus, createBusSubscription } from '../utils/EventBus';
import { FishingEvents } from './FishingSystem';
import { ShopEvents } from './Shop';
import { CombatEvents } from './CombatSystem';
import { StoryEvents } from './StoryProgress';
import { STARTER_QUESTS, type ObjectiveType, type QuestDefinition } from '../data/QuestData';
import type { GoldWallet } from './GoldWallet';
import type { StoryProgress } from './StoryProgress';
import type { Inventory } from './Inventory';

export const QuestEvents = {
  /** Payload: Quest — objective progress changed. */
  PROGRESS: 'quest-progress',
  /** Payload: Quest — became completable (all objectives met). */
  READY: 'quest-ready',
  /** Payload: Quest — turned in / rewarded. */
  COMPLETED: 'quest-completed',
  /** Payload: Quest — newly offered/started. */
  STARTED: 'quest-started',
  CHANGED: 'quest-changed'
} as const;

interface QuestRuntime {
  def: QuestDefinition;
  progress: number;
  state: 'active' | 'ready' | 'completed';
}

/**
 * Starter quest chain — the spine that guides a new player through the loop.
 *
 * Every objective is tracked by listening to events the game ALREADY emits
 * (CATCH_SUCCESS, ShopEvents.SOLD, ENEMY_DEFEATED, StoryEvents.FLAG_SET for
 * "reach" beats), so quests observe play without changing any system.
 * Rewards are applied through public APIs (GoldWallet.add, StoryProgress
 * unlock/rod). Fully serializable (completed ids + active progress).
 *
 * Quests auto-complete on reaching their target for this first pass (no
 * turn-in walk required), keeping early flow snappy; a future version can
 * gate turn-in on talking to the giver.
 */
export class QuestSystem {
  private readonly bus = createBusSubscription();
  private readonly quests = new Map<string, QuestRuntime>();
  private readonly gold: GoldWallet;
  private readonly story: StoryProgress;
  private readonly inventory?: Inventory;
  /**
   * When true, quest observers ignore gameplay events. The save system
   * sets this around restoration, because restoring the cooler re-emits
   * CATCH_SUCCESS for every stored fish — without this guard those synthetic
   * catches would advance (and pay out) catch-quests on every load,
   * duplicating gold. Bug fix; see SaveSystem.apply.
   */
  private restoring = false;

  constructor(gold: GoldWallet, story: StoryProgress, inventory?: Inventory) {
    this.gold = gold;
    this.story = story;
    this.inventory = inventory;

    this.bus.on(FishingEvents.CATCH_SUCCESS, this.onCatch, this);
    this.bus.on(ShopEvents.SOLD, this.onSold, this);
    this.bus.on(CombatEvents.ENEMY_DEFEATED, this.onDefeat, this);
    this.bus.on(StoryEvents.FLAG_SET, this.onFlag, this);

    for (const def of STARTER_QUESTS) {
      // Offer quests with no prerequisite immediately.
      if (!def.requires) this.offer(def);
    }
  }

  /** Toggle restore mode (suspends event-driven progress). Used by SaveSystem. */
  public setRestoring(value: boolean): void {
    this.restoring = value;
  }

  private offer(def: QuestDefinition): void {
    if (this.quests.has(def.id)) return;
    this.quests.set(def.id, { def, progress: 0, state: 'active' });
    EventBus.emit(QuestEvents.STARTED, def);
    EventBus.emit(QuestEvents.CHANGED);
  }

  /**
   * Manually offer a specific starter quest by id, regardless of its
   * `requires` chain — for quests meant to start at a specific narrative
   * moment (e.g. "FIRST CATCH", offered exactly when the rod is handed
   * over) rather than at world creation or another quest's completion.
   * Reuses the same private offer() every other quest goes through, so
   * progress tracking/rewards/events all work identically either way.
   */
  public offerQuestById(id: string): void {
    const def = STARTER_QUESTS.find((q) => q.id === id);
    if (def) this.offer(def);
  }

  private advance(type: ObjectiveType, amount: number, filter?: string): void {
    for (const q of this.quests.values()) {
      if (q.state !== 'active') continue;
      const obj = q.def.objective;
      if (obj.type !== type) continue;
      if (obj.filter && obj.filter !== filter) continue;

      q.progress = Math.min(obj.target, q.progress + amount);
      EventBus.emit(QuestEvents.PROGRESS, this.snapshot(q));

      if (q.progress >= obj.target) {
        this.complete(q);
      }
    }
  }

  private complete(q: QuestRuntime): void {
    q.state = 'completed';
    const r = q.def.reward;
    if (r.gold) this.gold.add(r.gold);
    if (r.unlockZone) this.story.unlockZone(r.unlockZone);
    if (r.rodTier) this.story.setRodTier(r.rodTier);
    // Item rewards (e.g. starter_sword, bait_worm) land in the general
    // inventory so they're actually received and visible. The inventory is
    // a generic id store; a future equipment/bait system reads these ids.
    if (r.item && this.inventory) this.inventory.add(r.item, 1);

    EventBus.emit(QuestEvents.COMPLETED, q.def);
    EventBus.emit(QuestEvents.CHANGED);

    // Offer any quests that were waiting on this one.
    for (const def of STARTER_QUESTS) {
      if (def.requires === q.def.id) this.offer(def);
    }
  }

  // ---- event handlers (read-only observers) --------------------------------
  private onCatch(): void {
    if (this.restoring) return;
    this.advance('catch', 1);
  }
  private onSold(): void {
    if (this.restoring) return;
    this.advance('sell', 1);
  }
  private onDefeat(): void {
    if (this.restoring) return;
    this.advance('defeat', 1);
  }
  private onFlag(flag: string): void {
    if (this.restoring) return;
    // "reach" objectives use a story flag as their filter.
    this.advance('reach', 1, flag);
  }

  // ---- queries / serialization --------------------------------------------
  public activeQuests(): { def: QuestDefinition; progress: number; target: number }[] {
    const out: { def: QuestDefinition; progress: number; target: number }[] = [];
    for (const q of this.quests.values()) {
      if (q.state === 'completed') continue;
      out.push({ def: q.def, progress: q.progress, target: q.def.objective.target });
    }
    return out;
  }

  public isCompleted(id: string): boolean {
    return this.quests.get(id)?.state === 'completed';
  }

  public get completedCount(): number {
    let n = 0;
    for (const q of this.quests.values()) if (q.state === 'completed') n++;
    return n;
  }

  private snapshot(q: QuestRuntime) {
    return { def: q.def, progress: q.progress, target: q.def.objective.target };
  }

  public toJSON(): { id: string; progress: number; state: string }[] {
    return [...this.quests.values()].map((q) => ({ id: q.def.id, progress: q.progress, state: q.state }));
  }

  public restore(saved: { id: string; progress: number; state: string }[] | undefined): void {
    if (!saved) return;
    const byId = new Map(STARTER_QUESTS.map((d) => [d.id, d]));
    this.quests.clear();
    for (const s of saved) {
      const def = byId.get(s.id);
      if (!def) continue;
      this.quests.set(s.id, {
        def,
        progress: s.progress,
        state: s.state === 'completed' ? 'completed' : 'active'
      });
    }
    // Make sure any prerequisite-free quests not in the save are offered.
    for (const def of STARTER_QUESTS) {
      if (!def.requires && !this.quests.has(def.id)) this.offer(def);
    }
    EventBus.emit(QuestEvents.CHANGED);
  }

  public destroy(): void {
    this.bus.dispose();
  }
}
