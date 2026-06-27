import { EventBus } from '../utils/EventBus';

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';

export const EnvironmentEvents = {
  /** Time-of-day period changed. Payload: TimeOfDay. */
  TIME_CHANGED: 'env-time-changed',
  /** Weather changed. Payload: Weather. */
  WEATHER_CHANGED: 'env-weather-changed',
  CHANGED: 'env-changed'
} as const;

/** Order of the day; used to advance and to map to fish `timeOfDay`. */
const TIME_ORDER: TimeOfDay[] = ['morning', 'day', 'evening', 'night'];

/** Weather pool with simple weights (clear is most common). */
const WEATHER_WEIGHTS: { weather: Weather; weight: number }[] = [
  { weather: 'clear', weight: 44 },
  { weather: 'cloudy', weight: 26 },
  { weather: 'rain', weight: 16 },
  { weather: 'fog', weight: 9 },
  { weather: 'storm', weight: 5 }
];

export interface EnvironmentState {
  /** Index into TIME_ORDER. */
  timeIndex: number;
  weather: Weather;
  /** Ms elapsed in the current time period (so saves resume mid-period). */
  elapsedMs: number;
}

export interface EnvironmentConfig {
  /** Real ms each time-of-day period lasts. Default ~2 min/period (8 min day). */
  periodMs?: number;
  /** Average number of periods between weather rerolls. */
  weatherEveryPeriods?: number;
}

/**
 * Lightweight day cycle + weather simulation.
 *
 * Advances morning → day → evening → night on a real-time clock, and
 * rerolls weather every few periods. It owns no rendering and no gameplay
 * rules — it only tracks state and emits events; other systems (fishing
 * fish-pools, the journal's "discovered under" data, future visual tints)
 * read `time`/`weather`. Fully serializable so the cycle resumes where the
 * player left off.
 *
 * Designed to expand: add a TimeOfDay/Weather value and it flows through
 * automatically; fish reference these via their data, no code change.
 */
export class Environment {
  private timeIndex = 1; // start at 'day'
  private weather: Weather = 'clear';
  private elapsedMs = 0;
  private periodsSinceWeather = 0;

  private readonly periodMs: number;
  private readonly weatherEveryPeriods: number;

  constructor(config: EnvironmentConfig = {}) {
    this.periodMs = config.periodMs ?? 120_000; // 2 real minutes per period
    this.weatherEveryPeriods = config.weatherEveryPeriods ?? 2;
  }

  public get time(): TimeOfDay {
    return TIME_ORDER[this.timeIndex];
  }

  public get currentWeather(): Weather {
    return this.weather;
  }

  /**
   * Maps the 4-period clock onto the fish data's simpler day/night flag, so
   * existing `timeOfDay: ['night']` fish keep working unchanged. Morning and
   * day count as "day"; evening and night count as "night".
   */
  public get dayNight(): 'day' | 'night' {
    return this.time === 'evening' || this.time === 'night' ? 'night' : 'day';
  }

  /** 0..1 progress through the current period (for a clock UI). */
  public get periodProgress(): number {
    return this.periodMs === 0 ? 0 : this.elapsedMs / this.periodMs;
  }

  /** Advance the clock. Call once per frame with delta ms. */
  public update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    while (this.elapsedMs >= this.periodMs) {
      this.elapsedMs -= this.periodMs;
      this.advancePeriod();
    }
  }

  private advancePeriod(): void {
    this.timeIndex = (this.timeIndex + 1) % TIME_ORDER.length;
    EventBus.emit(EnvironmentEvents.TIME_CHANGED, this.time);
    EventBus.emit(EnvironmentEvents.CHANGED);

    this.periodsSinceWeather += 1;
    if (this.periodsSinceWeather >= this.weatherEveryPeriods) {
      this.periodsSinceWeather = 0;
      this.rollWeather();
    }
  }

  private rollWeather(): void {
    const total = WEATHER_WEIGHTS.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * total;
    let next: Weather = 'clear';
    for (const w of WEATHER_WEIGHTS) {
      roll -= w.weight;
      if (roll <= 0) {
        next = w.weather;
        break;
      }
    }
    if (next !== this.weather) {
      this.weather = next;
      EventBus.emit(EnvironmentEvents.WEATHER_CHANGED, this.weather);
      EventBus.emit(EnvironmentEvents.CHANGED);
    }
  }

  public toJSON(): EnvironmentState {
    return { timeIndex: this.timeIndex, weather: this.weather, elapsedMs: this.elapsedMs };
  }

  public restore(state: Partial<EnvironmentState> | undefined): void {
    if (!state) return;
    if (typeof state.timeIndex === 'number' && state.timeIndex >= 0 && state.timeIndex < TIME_ORDER.length) {
      this.timeIndex = state.timeIndex;
    }
    if (state.weather) this.weather = state.weather;
    if (typeof state.elapsedMs === 'number' && state.elapsedMs >= 0) this.elapsedMs = state.elapsedMs;
    EventBus.emit(EnvironmentEvents.CHANGED);
  }
}

/** Display label for a time period (UI/feedback). */
export function timeOfDayLabel(t: TimeOfDay): string {
  return { morning: 'Morning', day: 'Day', evening: 'Evening', night: 'Night' }[t];
}

/** Display label for weather (UI/feedback). */
export function weatherLabel(w: Weather): string {
  return { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', fog: 'Fog' }[w];
}
