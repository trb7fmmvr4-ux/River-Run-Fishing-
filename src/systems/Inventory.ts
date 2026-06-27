export interface ItemStack {
  itemId: string;
  quantity: number;
}

/**
 * Generic, optionally capacity-limited item storage keyed by item id.
 *
 * This is the shared building block behind both the player's general
 * Inventory and the fish-specific Cooler — same storage semantics
 * either way, with different rules layered on top (the Cooler is just an
 * Inventory that only ever receives fish ids, with a capacity).
 *
 * Deliberately has no idea what an "item" actually is — no fish data,
 * no Phaser dependency. Anything that wants to display real names/values
 * resolves the itemId against its own data table (see Cooler.ts).
 */
export class Inventory {
  private readonly stacks = new Map<string, number>();
  private capacityLimit: number | null;

  constructor(capacityLimit: number | null = null) {
    this.capacityLimit = capacityLimit;
  }

  /** Null means unlimited. */
  public get capacity(): number | null {
    return this.capacityLimit;
  }

  public get totalCount(): number {
    let total = 0;
    for (const quantity of this.stacks.values()) {
      total += quantity;
    }
    return total;
  }

  public get isFull(): boolean {
    return this.capacityLimit !== null && this.totalCount >= this.capacityLimit;
  }

  /** Increases the capacity limit. No-op on an unlimited inventory. */
  public increaseCapacity(amount: number): void {
    if (this.capacityLimit === null) return;
    this.capacityLimit += amount;
  }

  /** Returns false (and adds nothing) if this would exceed capacity. */
  public add(itemId: string, quantity = 1): boolean {
    if (quantity <= 0) return false;
    if (this.capacityLimit !== null && this.totalCount + quantity > this.capacityLimit) {
      return false;
    }

    this.stacks.set(itemId, (this.stacks.get(itemId) ?? 0) + quantity);
    return true;
  }

  /** Returns false (and removes nothing) if there isn't enough to remove. */
  public remove(itemId: string, quantity = 1): boolean {
    const current = this.stacks.get(itemId) ?? 0;
    if (quantity <= 0 || current < quantity) return false;

    const next = current - quantity;
    if (next <= 0) {
      this.stacks.delete(itemId);
    } else {
      this.stacks.set(itemId, next);
    }
    return true;
  }

  public getQuantity(itemId: string): number {
    return this.stacks.get(itemId) ?? 0;
  }

  public list(): ItemStack[] {
    return Array.from(this.stacks.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  public clear(): void {
    this.stacks.clear();
  }
}
