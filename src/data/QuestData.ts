/**
 * Data-driven quest definitions.
 *
 * A quest is just data describing one objective and its reward — no
 * behavior. Like FishData and ZoneData, this file has zero Phaser
 * dependency; the runtime `QuestSystem` (systems/QuestSystem.ts) reads
 * these definitions and tracks live progress against them. Adding a new
 * quest is an entry in STARTER_QUESTS below; nothing in QuestSystem itself
 * needs to change.
 */

import type { ZoneId } from './ZoneData';

export type ObjectiveType = 'catch' | 'sell' | 'defeat' | 'reach';

export interface QuestObjective {
  type: ObjectiveType;
  /** Target count (e.g. catch 3). */
  target: number;
  /** Optional filter (specific fish id, zone id, etc.); absent = any. */
  filter?: string;
  description: string;
}

export interface QuestReward {
  gold?: number;
  /** Zone unlocked when this quest is completed. */
  unlockZone?: ZoneId;
  rodTier?: number;
  /** Free-form item id reward (bait, equipment) for future systems. */
  item?: string;
}

/** A single quest definition — pure data, no runtime state. */
export interface QuestDef {
  id: string;
  name: string;
  giver: string;
  summary: string;
  objective: QuestObjective;
  reward: QuestReward;
  /** Quest id that must be completed before this one is offered. */
  requires?: string;
}

/** @deprecated renamed to QuestDef for consistency with other data modules */
export type QuestDefinition = QuestDef;

/**
 * The starter quest chain — the spine that guides a new player through
 * the loop. Ordered, each guiding the next step. New quests are data —
 * add an entry here, no system change needed.
 */
export const STARTER_QUESTS: QuestDef[] = [
  {
    id: 'q_intro_first_catch',
    name: 'FIRST CATCH',
    giver: 'Old Fisherman',
    summary: 'Catch your first fish.',
    objective: { type: 'catch', target: 1, description: 'Catch your first fish (0/1)' },
    reward: { gold: 5 },
    // Sentinel: no real quest has this id, so the constructor's "offer
    // anything with no requires" pass skips it — this quest is only ever
    // offered explicitly, via offerQuestById(), at the exact moment the
    // opening sequence hands the player their rod. Keeps the existing
    // auto-offer behavior for every other starter quest untouched.
    requires: '__manual_offer_only__'
  },
  {
    id: 'q_first_catches',
    name: 'A Fisher Born',
    giver: 'Old Fisherman',
    summary: 'Catch 3 fish to get the hang of it.',
    objective: { type: 'catch', target: 3, description: 'Catch fish (0/3)' },
    reward: { gold: 15 }
  },
  {
    id: 'q_first_sale',
    name: 'Coin for Catch',
    giver: 'Shopkeeper',
    summary: 'Sell a fish at the village shop.',
    objective: { type: 'sell', target: 1, description: 'Sell a fish (0/1)' },
    reward: { gold: 20, item: 'bait_worm' },
    requires: 'q_first_catches'
  },
  {
    id: 'q_slime_slayer',
    name: 'Slime Trouble',
    giver: 'Hunter',
    summary: 'Slimes are a nuisance on the path. Clear a few.',
    objective: { type: 'defeat', target: 2, description: 'Defeat slimes (0/2)' },
    reward: { gold: 30, item: 'starter_sword' },
    requires: 'q_first_sale'
  },
  {
    id: 'q_reach_village',
    name: 'A Place to Belong',
    giver: 'Traveller',
    summary: 'Find your way to Riverside Village.',
    objective: { type: 'reach', target: 1, filter: 'reached_village', description: 'Reach the village' },
    reward: { gold: 25 }
  },
  {
    id: 'q_unlock_forest',
    name: 'Upriver',
    giver: 'Village Elder',
    summary: 'Prove yourself, then follow the river into the forest.',
    objective: { type: 'catch', target: 8, description: 'Catch fish (0/8)' },
    reward: { gold: 60, unlockZone: 'forest-river', rodTier: 2 },
    requires: 'q_slime_slayer'
  }
];

/** Look up a quest definition by id, or undefined if not found. */
export function getQuestById(id: string): QuestDef | undefined {
  return STARTER_QUESTS.find((q) => q.id === id);
}
