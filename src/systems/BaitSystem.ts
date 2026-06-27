import { EventBus } from '../utils/EventBus';
import { NO_BAIT_ID, getBait } from '../data/BaitData';

export const BaitEvents = {
  /** Equipped bait changed. Payload: bait id. */
  CHANGED: 'bait-changed'
} as const;

/**
 * Tracks which bait the player currently has equipped.
 *
 * Deliberately tiny: it holds a single equipped-bait id (defaulting to "no
 * bait") and exposes it so the fishing context can bias fish selection
 * toward fish that prefer that bait. Bait ids are ordinary inventory item
 * ids, so this reuses the existing item store — no parallel economy.
 *
 * Consumption (using up bait on a catch) is intentionally NOT implemented
 * here yet, to keep this lightweight; the equip/selection layer is the
 * piece other systems need now. It's serializable so the choice persists.
 */
export class BaitSystem {
  private equipped: string = NO_BAIT_ID;

  public get equippedId(): string {
    return this.equipped;
  }

  public get equippedName(): string {
    return getBait(this.equipped)?.name ?? 'No Bait';
  }

  /** Equip a bait by id. Unknown ids fall back to "no bait". */
  public equip(baitId: string): void {
    const valid = getBait(baitId) ? baitId : NO_BAIT_ID;
    if (valid === this.equipped) return;
    this.equipped = valid;
    EventBus.emit(BaitEvents.CHANGED, this.equipped);
  }

  public toJSON(): { equipped: string } {
    return { equipped: this.equipped };
  }

  public restore(state: { equipped?: string } | undefined): void {
    if (!state) return;
    this.equip(state.equipped ?? NO_BAIT_ID);
  }
}
