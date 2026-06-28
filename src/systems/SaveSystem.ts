import { EventBus } from '../utils/EventBus';
import { FISH_TABLE } from '../data/FishData';
import { auditRawSave } from '../data/SaveDataSchema';
import { FishingEvents } from '../systems/FishingSystem';
import type { GoldWallet } from '../systems/GoldWallet';
import type { Cooler } from '../systems/Cooler';
import type { Inventory } from '../systems/Inventory';
import type { Journal, JournalRecord } from '../systems/Journal';
import type { StoryProgress } from '../systems/StoryProgress';
import type { Progression } from '../systems/Progression';
import type { QuestSystem } from '../systems/QuestSystem';
import type { Environment } from '../systems/Environment';
import type { BaitSystem } from '../systems/BaitSystem';

/**
 * Lightweight, versioned save system (localStorage).
 *
 * It serializes game state by READING the existing economy systems'
 * public APIs and restores it by driving those same public APIs /
 * EventBus events — so it never reaches into or modifies any gameplay
 * system. That keeps it fully additive and means new saveable state is
 * added here (and in the capture/apply functions) without touching the
 * systems that own the data.
 *
 * Three slots are provided for a simple save/load menu; "Continue" uses
 * whichever slot was most recently written (tracked by `lastSlot`).
 */

export interface SaveData {
  version: number;
  savedAt: number; // epoch ms
  gold: number;
  coolerCapacity: number;
  cooler: { fishId: string; quantity: number }[];
  /** General inventory items (e.g. quest-reward sword/bait). */
  inventory?: { itemId: string; quantity: number }[];
  /**
   * Optional extended state, all additive so older saves (and callers that
   * only pass gold+cooler) keep working. Absent fields are simply skipped
   * on load.
   */
  player?: { x: number; y: number; zoneId?: string };
  journal?: unknown[]; // legacy: string ids; current: JournalRecord[]
  story?: { flags: string[]; unlockedZones: string[]; rodTier: number };
  progression?: { fishing: { level: number; xp: number }; combat: { level: number; xp: number }; crafting: { level: number; xp: number } };
  quests?: { id: string; progress: number; state: string }[];
  /** Day-cycle + weather state. */
  environment?: { timeIndex: number; weather: string; elapsedMs: number };
  /** Equipped bait id. */
  bait?: { equipped: string };
  /** Reserved for further future expansion (rod parts, quests, housing...). */
  meta?: Record<string, unknown>;
}

export interface SaveSlotInfo {
  slot: number;
  exists: boolean;
  savedAt?: number;
  gold?: number;
  coolerCount?: number;
}

const SAVE_VERSION = 1;
const SLOT_COUNT = 3;
const slotKey = (slot: number) => `river-run-fishing:save:v1:slot${slot}`;
const LAST_SLOT_KEY = 'river-run-fishing:save:v1:last';

const FISH_BY_ID = new Map(FISH_TABLE.map((f) => [f.id, f]));

/**
 * Save migration chain.
 *
 * Each entry upgrades a save FROM the given version TO the next one. To add
 * a breaking change later: bump SAVE_VERSION, then add a `[oldVersion]: (d)
 * => upgraded` step here. `migrate()` runs every step from the save's
 * version up to current, so a v1 save loaded by a v4 build walks 1→2→3→4.
 *
 * It's intentionally tiny — no steps exist yet (we're at v1) — but the
 * plumbing is in place so the first real schema change is a one-line add,
 * not a scramble. Migrations must be pure and defensive (tolerate missing
 * fields), since they run on player data.
 */
type Migration = (data: SaveData) => SaveData;

const MIGRATIONS: Record<number, Migration> = {
  // Example shape for the future (do not enable):
  // 1: (d) => ({ ...d, version: 2, newField: defaultValue })
};

function migrate(data: SaveData, fromVersion: number): SaveData {
  let current = data;
  let v = fromVersion;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) {
      // No migration registered for this step — stamp it forward so the
      // loop terminates. Safe because no breaking change was recorded.
      current = { ...current, version: v + 1 };
    } else {
      current = step(current);
    }
    v += 1;
  }
  // Ensure the version stamp reflects the current build.
  current.version = SAVE_VERSION;
  return current;
}

export interface SaveableSystems {
  gold: GoldWallet;
  cooler: Cooler;
  /** Optional extended systems — captured/restored only if provided. */
  inventory?: Inventory;
  journal?: Journal;
  story?: StoryProgress;
  progression?: Progression;
  quests?: QuestSystem;
  environment?: Environment;
  bait?: BaitSystem;
  /** Supplies the player's current position + zone at save time. */
  getPlayerState?: () => { x: number; y: number; zoneId?: string };
  /** Applies a saved position back to the player on load. */
  setPlayerPosition?: (x: number, y: number) => void;
}

export const SaveSystem = {
  SLOT_COUNT,

  /** Build a SaveData snapshot from the live systems (read-only). */
  capture(systems: SaveableSystems): SaveData {
    const data: SaveData = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      gold: systems.gold.balance,
      coolerCapacity: systems.cooler.capacity,
      cooler: systems.cooler.listFish().map((s) => ({ fishId: s.fishId, quantity: s.quantity }))
    };
    if (systems.getPlayerState) data.player = systems.getPlayerState();
    if (systems.inventory) data.inventory = systems.inventory.list();
    if (systems.journal) data.journal = systems.journal.toJSON();
    if (systems.story) data.story = systems.story.toJSON();
    if (systems.progression) data.progression = systems.progression.toJSON();
    if (systems.quests) data.quests = systems.quests.toJSON();
    if (systems.environment) data.environment = systems.environment.toJSON();
    if (systems.bait) data.bait = systems.bait.toJSON();
    return data;
  },

  /** Write a snapshot of the current game to a slot. */
  save(slot: number, systems: SaveableSystems): boolean {
    try {
      const data = this.capture(systems);
      localStorage.setItem(slotKey(slot), JSON.stringify(data));
      localStorage.setItem(LAST_SLOT_KEY, String(slot));
      return true;
    } catch {
      return false;
    }
  },

  /** Read a slot's raw data, or null if empty/corrupt/incompatible. */
  read(slot: number): SaveData | null {
    try {
      const raw = localStorage.getItem(slotKey(slot));
      if (!raw) return null;
      const rawParsed = JSON.parse(raw) as unknown;
      // Structural audit before migration — catches field-type mismatches
      // that would silently produce wrong state after apply().
      const reason = auditRawSave(rawParsed);
      if (reason) {
        console.warn(`[SaveSystem] slot ${slot} rejected: ${reason}`);
        return null;
      }
      const parsed = rawParsed as Partial<SaveData>;

      // Version handling. Treat a missing version as v1 (the first format,
      // which predated this field). Refuse to load saves newer than this
      // build understands rather than silently mangling them.
      const version = typeof parsed.version === 'number' ? parsed.version : 1;
      if (version > SAVE_VERSION) {
        console.warn(
          `[SaveSystem] slot ${slot} is from a newer version (v${version} > v${SAVE_VERSION}); refusing to load.`
        );
        return null;
      }

      // Run forward migrations to bring older saves up to the current shape.
      const migrated = migrate(parsed as SaveData, version);
      return migrated;
    } catch {
      return null;
    }
  },

  /**
   * Apply a saved snapshot onto freshly-constructed systems, using only
   * their public APIs / events. Intended to be called right after a new
   * game's systems are created, before the player starts interacting.
   */
  apply(data: SaveData, systems: SaveableSystems): void {
    // Suspend event-driven side-effects for the whole restore: re-adding
    // cooler fish below re-emits CATCH_SUCCESS, which would otherwise
    // advance/pay-out quests, grant XP, and fire spurious "level up / new
    // record / quest complete" toasts on every load. Restored state is
    // applied explicitly further down. See each system's setRestoring().
    systems.quests?.setRestoring(true);
    systems.progression?.setRestoring(true);
    systems.journal?.setRestoring(true);

    // Gold: add up to the saved balance (systems start at 0).
    if (data.gold > 0) {
      systems.gold.add(data.gold);
    }

    // Cooler capacity: expand from the starting capacity to the saved one.
    const extra = data.coolerCapacity - systems.cooler.capacity;
    if (extra > 0) {
      systems.cooler.expandCapacity(extra);
    }

    // Cooler contents: re-add each fish via the same public catch event the
    // Cooler already listens to — the legitimate path fish enter storage.
    for (const stack of data.cooler) {
      const fish = FISH_BY_ID.get(stack.fishId);
      if (!fish) continue;
      for (let i = 0; i < stack.quantity; i++) {
        EventBus.emit(FishingEvents.CATCH_SUCCESS, fish);
      }
    }

    // General inventory (quest-reward items etc.). Clear then re-add so a
    // load is exact rather than additive on top of starting items.
    if (data.inventory && systems.inventory) {
      systems.inventory.clear();
      for (const stack of data.inventory) {
        systems.inventory.add(stack.itemId, stack.quantity);
      }
    }

    // Extended state (all optional / additive). Restore story & journal
    // BEFORE anything that might react to them; position last.
    if (data.story && systems.story) {
      systems.story.restore(data.story);
    }
    if (data.journal && systems.journal) {
      // Restore the journal set directly. (Re-emitting catch events above
      // would also mark these discovered, but an explicit restore is exact
      // and order-independent.)
      systems.journal.restore(data.journal as JournalRecord[] | string[]);
    }
    if (data.progression && systems.progression) {
      systems.progression.restore(data.progression);
    }
    if (data.quests && systems.quests) {
      systems.quests.restore(data.quests);
    }
    if (data.environment && systems.environment) {
      systems.environment.restore(data.environment as { timeIndex: number; weather: import('../systems/Environment').Weather; elapsedMs: number });
    }
    if (data.bait && systems.bait) {
      systems.bait.restore(data.bait);
    }
    if (data.player && systems.setPlayerPosition) {
      systems.setPlayerPosition(data.player.x, data.player.y);
    }

    // Restore complete — re-enable event-driven progress from live gameplay.
    systems.quests?.setRestoring(false);
    systems.progression?.setRestoring(false);
    systems.journal?.setRestoring(false);
  },

  /** Delete a slot (used by "New Game" overwriting, or an explicit clear). */
  clear(slot: number): void {
    try {
      localStorage.removeItem(slotKey(slot));
      if (localStorage.getItem(LAST_SLOT_KEY) === String(slot)) {
        localStorage.removeItem(LAST_SLOT_KEY);
      }
    } catch {
      /* ignore */
    }
  },

  /** The most-recently-saved slot, for "Continue". */
  lastSlot(): number | null {
    try {
      const raw = localStorage.getItem(LAST_SLOT_KEY);
      if (raw === null) return null;
      const n = parseInt(raw, 10);
      return Number.isNaN(n) ? null : n;
    } catch {
      return null;
    }
  },

  /** True if any slot has data (controls whether "Continue" is enabled). */
  hasAnySave(): boolean {
    for (let s = 0; s < SLOT_COUNT; s++) {
      if (this.read(s)) return true;
    }
    return false;
  },

  /** Summary of all slots for a save/load menu. */
  listSlots(): SaveSlotInfo[] {
    const out: SaveSlotInfo[] = [];
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const data = this.read(slot);
      out.push(
        data
          ? {
              slot,
              exists: true,
              savedAt: data.savedAt,
              gold: data.gold,
              coolerCount: data.cooler.reduce((n, s) => n + s.quantity, 0)
            }
          : { slot, exists: false }
      );
    }
    return out;
  }
};
