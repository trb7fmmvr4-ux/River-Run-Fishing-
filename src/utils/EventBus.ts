import Phaser from 'phaser';

/**
 * A single, explicit event channel shared across systems.
 *
 * This exists so systems (fishing, inventory, combat, journal, quests,
 * progression…) can communicate without reaching into each other directly
 * or relying on ad-hoc global variables — it's the one intentional piece of
 * shared state in the project, and it only ever carries events, never game
 * state itself.
 *
 * NOTE: this emitter is a GLOBAL singleton and survives Phaser scene
 * restarts. Every listener must be removed when its owner is torn down, or
 * it leaks across a return-to-menu-and-replay cycle. Today every system
 * does this correctly (each `on` has a matching `off`/`once`); the
 * `BusSubscription` helper below exists to keep that true as the codebase
 * grows, by making "subscribe now, clean up all at once" a one-liner.
 */
export const EventBus = new Phaser.Events.EventEmitter();

type Handler = (...args: any[]) => void;

/**
 * A lightweight, opt-in subscription scope for the global EventBus.
 *
 * Additive safeguard (it does NOT replace or wrap EventBus — raw
 * `EventBus.on/off/emit` keep working unchanged). A system can instead do:
 *
 *   private bus = createBusSubscription();
 *   // in setup:
 *   this.bus.on(SomeEvents.THING, this.onThing, this);
 *   // in destroy():
 *   this.bus.dispose();   // removes everything registered through this scope
 *
 * Because `dispose()` removes exactly what the scope registered (by event,
 * handler, and context), it's impossible to forget an individual `off()` —
 * the single most common source of listener leaks. Existing systems are
 * left as-is; this is for new code and any future refactors that opt in.
 */
export class BusSubscription {
  private readonly records: { event: string; handler: Handler; context?: unknown }[] = [];

  /** Subscribe and track for later disposal. Mirrors EventBus.on signature. */
  public on(event: string, handler: Handler, context?: unknown): this {
    EventBus.on(event, handler, context);
    this.records.push({ event, handler, context });
    return this;
  }

  /** Subscribe once (auto-removes after firing); still tracked for safety. */
  public once(event: string, handler: Handler, context?: unknown): this {
    EventBus.once(event, handler, context);
    this.records.push({ event, handler, context });
    return this;
  }

  /** Remove every subscription registered through this scope. */
  public dispose(): void {
    for (const { event, handler, context } of this.records) {
      EventBus.off(event, handler, context);
    }
    this.records.length = 0;
  }

  /** How many live subscriptions this scope is tracking (handy in tests). */
  public get size(): number {
    return this.records.length;
  }
}

/** Factory for a fresh subscription scope. */
export function createBusSubscription(): BusSubscription {
  return new BusSubscription();
}
