import { EventBus } from '../utils/EventBus';

export const GoldEvents = {
  CHANGED: 'gold-changed'
} as const;

/**
 * Tracks the player's gold balance.
 *
 * Shop is the only thing that should call add()/spend() — it's the
 * single orchestrator for the economy's two exchange actions (selling
 * fish, buying upgrades). Anything that just wants to display the
 * balance should read `.balance` or listen for GoldEvents.CHANGED.
 */
export class GoldWallet {
  private amount: number;

  constructor(startingAmount = 0) {
    this.amount = startingAmount;
  }

  public get balance(): number {
    return this.amount;
  }

  public add(value: number): void {
    if (value <= 0) return;
    this.amount += value;
    EventBus.emit(GoldEvents.CHANGED, this.amount);
  }

  /** Returns false (and spends nothing) if the balance can't cover it. */
  public spend(value: number): boolean {
    if (value <= 0 || value > this.amount) return false;
    this.amount -= value;
    EventBus.emit(GoldEvents.CHANGED, this.amount);
    return true;
  }
}
