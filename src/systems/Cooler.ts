import { EventBus } from '../utils/EventBus';
import { FishingEvents } from './FishingSystem';
import { Inventory } from './Inventory';
import { FISH_TABLE, type FishDefinition } from '../data/FishData';

export const CoolerEvents = {
  CHANGED: 'cooler-changed',
  FULL: 'cooler-full'
} as const;

export interface CoolerFishStack {
  fishId: string;
  name: string;
  quantity: number;
  unitValue: number;
}

const FISH_BY_ID = new Map<string, FishDefinition>(FISH_TABLE.map((fish) => [fish.id, fish]));

/**
 * Fish-only storage with a capacity limit, built on top of the generic
 * Inventory primitive.
 *
 * Listens directly for FishingEvents.CATCH_SUCCESS and deposits the catch
 * automatically — FishingSystem has no idea the Cooler exists, and never
 * will need to. If the cooler is full, the catch is lost and
 * CoolerEvents.FULL fires instead (FishingHUD listens for this to let the
 * player know why).
 */
export class Cooler {
  private readonly storage: Inventory;

  constructor(initialCapacity: number) {
    this.storage = new Inventory(initialCapacity);
    EventBus.on(FishingEvents.CATCH_SUCCESS, this.onCatchSuccess, this);
  }

  public get count(): number {
    return this.storage.totalCount;
  }

  public get capacity(): number {
    return this.storage.capacity ?? 0;
  }

  public get isFull(): boolean {
    return this.storage.isFull;
  }

  public expandCapacity(amount: number): void {
    this.storage.increaseCapacity(amount);
    EventBus.emit(CoolerEvents.CHANGED);
  }

  public listFish(): CoolerFishStack[] {
    return this.storage.list().map(({ itemId, quantity }) => {
      const fish = FISH_BY_ID.get(itemId);
      return {
        fishId: itemId,
        name: fish?.name ?? itemId,
        quantity,
        unitValue: fish?.value ?? 0
      };
    });
  }

  /** Removes one of the given fish, if present. Returns its gold value, or null if it wasn't there. */
  public removeFish(fishId: string): number | null {
    const fish = FISH_BY_ID.get(fishId);
    if (!fish) return null;
    if (!this.storage.remove(fishId, 1)) return null;

    EventBus.emit(CoolerEvents.CHANGED);
    return fish.value;
  }

  /** Removes everything currently stored. Returns the total gold value it was worth. */
  public removeAllFish(): number {
    let total = 0;
    for (const stack of this.storage.list()) {
      const fish = FISH_BY_ID.get(stack.itemId);
      if (fish) total += fish.value * stack.quantity;
    }

    this.storage.clear();
    EventBus.emit(CoolerEvents.CHANGED);
    return total;
  }

  private onCatchSuccess(fish: FishDefinition): void {
    const added = this.storage.add(fish.id, 1);
    if (added) {
      EventBus.emit(CoolerEvents.CHANGED);
    } else {
      EventBus.emit(CoolerEvents.FULL, fish);
    }
  }

  public destroy(): void {
    EventBus.off(FishingEvents.CATCH_SUCCESS, this.onCatchSuccess, this);
  }
}
