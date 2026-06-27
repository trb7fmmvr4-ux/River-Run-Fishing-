import Phaser from 'phaser';
import { FISHING } from '../config/GameConfig';
import { EventBus } from '../utils/EventBus';
import { pickRandomFish, pickFish, type FishDefinition, type FishPickContext } from '../data/FishData';

export const FishingState = {
  IDLE: 'idle',
  WAITING: 'waiting',
  BITING: 'biting',
  RESOLVED: 'resolved'
} as const;
export type FishingStateType = (typeof FishingState)[keyof typeof FishingState];

export const FishingEvents = {
  CAST: 'fishing-cast',
  TENSION: 'fishing-tension',
  BITE: 'fishing-bite',
  CATCH_SUCCESS: 'fishing-catch-success',
  CATCH_FAILURE: 'fishing-catch-failure',
  NOT_IN_ZONE: 'fishing-not-in-zone',
  /** The cast was abandoned (player walked away/equipped a different tool) before any catch resolved. */
  CANCELLED: 'fishing-cancelled'
} as const;

/**
 * The core fishing loop, as a small state machine:
 *
 *   idle -> waiting (after a cast) -> biting (reaction window open)
 *        -> resolved (result shown briefly) -> back to idle
 *
 * While waiting, a single random "tremor" tell may fire partway through
 * (purely cosmetic — it doesn't open a reaction window) to build tension
 * without telegraphing the real bite. The reaction window itself is also
 * jittered by a few percent each time, so the same fish never feels
 * perfectly identical to react to twice in a row.
 *
 * This class has no idea how its events are presented — it only emits on
 * the shared EventBus. FishingHUD is what turns these into on-screen text,
 * camera feedback, and the reaction timing bar. That separation means a
 * different presentation (or none at all, for an automated test) could be
 * swapped in without touching this file.
 */
export class FishingSystem {
  private readonly scene: Phaser.Scene;
  private state: FishingStateType = FishingState.IDLE;
  private activeFish: FishDefinition | null = null;
  private biteTimer?: Phaser.Time.TimerEvent;
  private tensionTimer?: Phaser.Time.TimerEvent;
  private reactionTimer?: Phaser.Time.TimerEvent;
  private resolvedTimer?: Phaser.Time.TimerEvent;
  /**
   * Optional source of the player's current rod tier (1+). Additive hook:
   * if never set, tier defaults to 1 and fishing behaves exactly as before.
   * A better rod widens the reaction window, making bites easier to land —
   * a meaningful, balance-safe reward that needs no change to the fishing
   * state machine. Ready for a future rod-parts system to feed richer tiers.
   */
  private rodTierProvider?: () => number;
  /**
   * Optional source of the current fishing context (zone, time of day,
   * weather, bait). Additive: if unset, fish are picked from the whole table
   * exactly as before. When provided, the catch is drawn from the right zone
   * pool and biased by weather/bait — making where/when/how you fish matter.
   */
  private fishContextProvider?: () => FishPickContext;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Wire a rod-tier source (e.g. StoryProgress.rod). Optional + additive. */
  public setRodTierProvider(provider: () => number): void {
    this.rodTierProvider = provider;
  }

  /** Wire a fishing-context source (zone/time/weather/bait). Optional + additive. */
  public setFishContextProvider(provider: () => FishPickContext): void {
    this.fishContextProvider = provider;
  }

  /**
   * Reaction-window multiplier from the current rod tier. Tier 1 = 1.0
   * (unchanged). Each tier adds 8% more reaction time, capped so it never
   * trivialises timing (+40% max). Pure function of tier; safe if unset.
   */
  private rodReactionMultiplier(): number {
    const tier = Math.max(1, this.rodTierProvider?.() ?? 1);
    return Math.min(1.4, 1 + (tier - 1) * 0.08);
  }

  public get currentState(): FishingStateType {
    return this.state;
  }

  /** True while the fishing loop is occupying the player (cast through result). */
  public get isActive(): boolean {
    return this.state !== FishingState.IDLE;
  }

  /**
   * Single entry point for the action button: casts if idle and standing
   * in a fishing zone, or reacts to an open bite. Any other press (e.g.
   * mashing the button while waiting) is silently ignored.
   */
  public handleActionPress(isInZone: boolean): void {
    if (this.state === FishingState.IDLE) {
      if (isInZone) {
        this.cast();
      } else {
        EventBus.emit(FishingEvents.NOT_IN_ZONE);
      }
      return;
    }

    if (this.state === FishingState.BITING) {
      this.reactToBite();
    }
  }

  /**
   * Abandon an in-progress cast (the player walked away, or switched to a
   * different equipped tool) without it counting as a catch or a failure.
   * Safe to call from any state — a no-op if already idle or already
   * showing a result. Purely additive: every existing state transition
   * (cast/bite/resolve) is unchanged; this just gives the caller a clean
   * way to bail out of WAITING/BITING from the outside.
   */
  public cancel(): void {
    if (this.state === FishingState.IDLE || this.state === FishingState.RESOLVED) return;

    this.biteTimer?.remove();
    this.tensionTimer?.remove();
    this.reactionTimer?.remove();
    this.activeFish = null;
    this.state = FishingState.IDLE;
    EventBus.emit(FishingEvents.CANCELLED);
  }

  private cast(): void {
    this.state = FishingState.WAITING;
    EventBus.emit(FishingEvents.CAST);

    const waitMs = Phaser.Math.Between(FISHING.MIN_WAIT_MS, FISHING.MAX_WAIT_MS);
    this.biteTimer = this.scene.time.delayedCall(waitMs, this.triggerBite, undefined, this);
    this.scheduleTensionTremor(waitMs);
  }

  /** A cosmetic "did something just move?" tell partway through the wait. */
  private scheduleTensionTremor(waitMs: number): void {
    if (waitMs < FISHING.TREMOR_MIN_WAIT_MS) return;

    const fraction = Phaser.Math.FloatBetween(FISHING.TREMOR_MIN_FRACTION, FISHING.TREMOR_MAX_FRACTION);
    const tremorDelay = Math.round(waitMs * fraction);

    this.tensionTimer = this.scene.time.delayedCall(tremorDelay, () => {
      if (this.state === FishingState.WAITING) {
        EventBus.emit(FishingEvents.TENSION);
      }
    });
  }

  private triggerBite(): void {
    if (this.state !== FishingState.WAITING) return;
    this.tensionTimer?.remove();

    const ctx = this.fishContextProvider?.();
    const fish = ctx ? pickFish(ctx) : pickRandomFish();
    const jitter = Phaser.Math.FloatBetween(FISHING.REACTION_JITTER_MIN, FISHING.REACTION_JITTER_MAX);
    // Rod tier widens the reaction window (easier to land bites). Multiplier
    // is 1.0 at tier 1, so default behaviour is unchanged.
    const windowMs = Math.round(fish.reactionWindowMs * jitter * this.rodReactionMultiplier());

    this.activeFish = fish;
    this.state = FishingState.BITING;
    EventBus.emit(FishingEvents.BITE, fish, windowMs);

    this.reactionTimer = this.scene.time.delayedCall(windowMs, this.resolveFailure, undefined, this);
  }

  private reactToBite(): void {
    if (this.state !== FishingState.BITING) return;
    this.reactionTimer?.remove();
    this.resolveSuccess();
  }

  private resolveSuccess(): void {
    const fish = this.activeFish;

    // Guard: every listener of CATCH_SUCCESS (Cooler, FishingHUD) treats
    // the payload as a non-null FishDefinition. The state machine already
    // guarantees activeFish is set here, but this makes that contract
    // explicit and fail-safe — if a future code path ever reaches this
    // without an active fish, we fail the catch rather than emit null and
    // silently corrupt the cooler.
    if (!fish) {
      this.resolveFailure();
      return;
    }

    this.state = FishingState.RESOLVED;
    EventBus.emit(FishingEvents.CATCH_SUCCESS, fish);
    this.scheduleReturnToIdle();
  }

  private resolveFailure(): void {
    this.state = FishingState.RESOLVED;
    EventBus.emit(FishingEvents.CATCH_FAILURE);
    this.scheduleReturnToIdle();
  }

  private scheduleReturnToIdle(): void {
    this.activeFish = null;
    this.resolvedTimer = this.scene.time.delayedCall(FISHING.RESULT_DISPLAY_MS, () => {
      this.state = FishingState.IDLE;
    });
  }

  public destroy(): void {
    this.biteTimer?.remove();
    this.tensionTimer?.remove();
    this.reactionTimer?.remove();
    this.resolvedTimer?.remove();
  }
}
