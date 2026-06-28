import { EventBus, createBusSubscription } from '../utils/EventBus';
import { FishingEvents } from './FishingSystem';
import { CombatEvents } from './CombatSystem';
import type { FishDefinition, FishRarity } from '../data/FishData';

export type SkillId = 'fishing' | 'combat' | 'crafting';

export const ProgressionEvents = {
  /** Payload: { skill, xp, total } */
  XP_GAINED: 'progression-xp',
  /** Payload: { skill, level } */
  LEVEL_UP: 'progression-levelup',
  CHANGED: 'progression-changed'
} as const;

const RARITY_XP: Record<FishRarity, number> = {
  common: 5,
  uncommon: 12,
  rare: 30,
  legendary: 80,
  exotic: 200
};

/** XP needed to go FROM level n TO n+1. Gentle curve, long-term goals. */
function xpForLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.5));
}

interface SkillState {
  level: number;
  xp: number; // xp within the current level
}

export interface ProgressionState {
  fishing: SkillState;
  combat: SkillState;
  crafting: SkillState;
}

/**
 * Player progression: Fishing, Combat, and Crafting levels driven by XP.
 *
 * Hooks the EXISTING events — CATCH_SUCCESS (fishing XP, scaled by rarity)
 * and ENEMY_DEFEATED (combat XP) — so it earns XP from real play without
 * touching those systems. Crafting is wired for the future (gainXp is
 * public) but has no source yet. Levels are queryable so other systems can
 * gate content and tune performance (e.g. bite windows) off fishing level.
 *
 * Fully serializable; the save system captures/restores it like the other
 * progression data.
 */
export class Progression {
  private readonly bus = createBusSubscription();
  private readonly skills: Record<SkillId, SkillState> = {
    fishing: { level: 1, xp: 0 },
    combat: { level: 1, xp: 0 },
    crafting: { level: 1, xp: 0 }
  };
  /**
   * When true, event-driven XP is ignored. The save system sets this around
   * restoration, because restoring the cooler re-emits CATCH_SUCCESS for
   * every stored fish — without this guard those synthetic catches would
   * grant XP and fire spurious LEVEL_UP toasts on every load. Restored
   * levels are applied explicitly via restore().
   */
  private restoring = false;

  constructor() {
    this.bus.on(FishingEvents.CATCH_SUCCESS, this.onCatch, this);
    this.bus.on(CombatEvents.ENEMY_DEFEATED, this.onEnemyDefeated, this);
  }

  /** Toggle restore mode (suspends event-driven XP). Used by SaveSystem. */
  public setRestoring(value: boolean): void {
    this.restoring = value;
  }

  private onCatch(fish: FishDefinition): void {
    if (this.restoring) return;
    this.gainXp('fishing', RARITY_XP[fish.rarity] ?? 5);
  }

  private onEnemyDefeated(): void {
    if (this.restoring) return;
    this.gainXp('combat', 8);
  }

  /** Add XP to a skill, handling multi-level-ups. Public for future sources. */
  public gainXp(skill: SkillId, amount: number): void {
    if (amount <= 0) return;
    const s = this.skills[skill];
    s.xp += amount;
    EventBus.emit(ProgressionEvents.XP_GAINED, { skill, xp: amount, total: s.xp });

    let leveled = false;
    while (s.xp >= xpForLevel(s.level)) {
      s.xp -= xpForLevel(s.level);
      s.level += 1;
      leveled = true;
      EventBus.emit(ProgressionEvents.LEVEL_UP, { skill, level: s.level });
    }
    if (leveled) EventBus.emit(ProgressionEvents.CHANGED);
  }

  public level(skill: SkillId): number {
    return this.skills[skill].level;
  }

  public xpInLevel(skill: SkillId): number {
    return this.skills[skill].xp;
  }

  public xpToNext(skill: SkillId): number {
    return xpForLevel(this.skills[skill].level);
  }

  /** 0..1 progress through the current level, for a UI bar. */
  public levelProgress(skill: SkillId): number {
    const need = this.xpToNext(skill);
    return need === 0 ? 0 : this.skills[skill].xp / need;
  }

  /** Total level across all skills — a simple "power" summary. */
  public get totalLevel(): number {
    return this.skills.fishing.level + this.skills.combat.level + this.skills.crafting.level;
  }

  public toJSON(): ProgressionState {
    return {
      fishing: { ...this.skills.fishing },
      combat: { ...this.skills.combat },
      crafting: { ...this.skills.crafting }
    };
  }

  public restore(state: Partial<ProgressionState> | undefined): void {
    if (!state) return;
    for (const id of ['fishing', 'combat', 'crafting'] as SkillId[]) {
      const s = state[id];
      if (s && typeof s.level === 'number') {
        this.skills[id] = { level: s.level, xp: s.xp ?? 0 };
      }
    }
    EventBus.emit(ProgressionEvents.CHANGED);
  }

  public destroy(): void {
    this.bus.dispose();
  }
}
