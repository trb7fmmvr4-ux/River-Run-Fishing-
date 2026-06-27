import { SettingsStore } from '../systems/SettingsStore';

/**
 * Minimal placeholder sound effects via raw WebAudio oscillator beeps —
 * no audio files needed, consistent with the project's zero-external-
 * asset approach so far. Every call is wrapped defensively: if WebAudio
 * is unavailable or blocked (e.g. no user gesture has happened yet),
 * these fail silently instead of breaking the fishing loop.
 *
 * Beep volumes are now scaled by the player's saved Master × SFX volume
 * settings, so the audio sliders in Settings actually affect these cues.
 * The multiplier is refreshed on demand via refreshVolume() (call after a
 * settings change) and read once at construction.
 *
 * Swap this out for real loaded sound effects later — everything that
 * calls these only cares about "play the cast/bite/catch/fail cue", not
 * how that cue is actually produced.
 */
export class PlaceholderSound {
  private context: AudioContext | null = null;
  private volumeScale = 1;

  constructor() {
    this.refreshVolume();
  }

  /** Re-read Master × SFX from settings. Call after the player changes them. */
  public refreshVolume(): void {
    try {
      const audio = SettingsStore.load().audio;
      this.volumeScale = Math.max(0, Math.min(1, audio.master * audio.sfx));
    } catch {
      this.volumeScale = 1;
    }
  }

  private getContext(): AudioContext | null {
    if (this.context) return this.context;

    try {
      this.context = new AudioContext();
      return this.context;
    } catch {
      return null;
    }
  }

  private beep(frequency: number, durationMs: number, type: OscillatorType, volume: number, delayMs = 0): void {
    const ctx = this.getContext();
    if (!ctx) return;

    // Honour the player's volume settings; skip entirely if muted.
    const effectiveVolume = volume * this.volumeScale;
    if (effectiveVolume <= 0.0001) return;

    try {
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const now = ctx.currentTime + delayMs / 1000;
      const durationSec = durationMs / 1000;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(effectiveVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(now);
      oscillator.stop(now + durationSec + 0.02);
    } catch {
      // Audio is a nice-to-have here; never let it break the fishing loop.
    }
  }

  public playCast(): void {
    this.beep(380, 90, 'sine', 0.04);
  }

  public playBite(): void {
    this.beep(640, 70, 'square', 0.05);
  }

  public playCatchSuccess(): void {
    this.beep(880, 180, 'sine', 0.06);
  }

  public playCatchFailure(): void {
    this.beep(160, 200, 'sawtooth', 0.04);
  }

  /** Generic UI click — panel toggles, button presses. Short and unobtrusive. */
  public playClick(): void {
    this.beep(520, 40, 'square', 0.03);
  }

  /** Selling fish / completing a shop transaction. */
  public playSell(): void {
    this.beep(700, 90, 'sine', 0.05);
  }

  /** Equipping bait or similar small confirm action. */
  public playConfirm(): void {
    this.beep(500, 60, 'triangle', 0.04);
  }

  /** Receiving a real item for the first time (e.g. the starter rod) — a small rising two-note chime, bigger than playConfirm. */
  public playReceiveItem(): void {
    this.beep(520, 70, 'triangle', 0.045);
    this.beep(760, 90, 'triangle', 0.045, 70);
  }

  /** A quest fully completing — a brighter three-note fanfare, the biggest of the achievement-style cues. */
  public playQuestComplete(): void {
    this.beep(523, 80, 'triangle', 0.05);
    this.beep(659, 80, 'triangle', 0.05, 90);
    this.beep(880, 120, 'triangle', 0.055, 180);
  }

  /** A notification toast appearing (quest/discovery/record/etc). Quiet — these fire often. */
  public playNotify(): void {
    this.beep(760, 50, 'sine', 0.025);
  }

  /** Bumping into a solid object (tree, rock). Short and low — a "thud", not an alarm. */
  public playBump(): void {
    this.beep(140, 60, 'square', 0.035);
  }

  /** Hovering a menu button — very quiet, just a tick, since it fires often. */
  public playHover(): void {
    this.beep(620, 30, 'sine', 0.018);
  }

  /** Keyboard/gamepad focus moving between menu buttons. */
  public playNavigate(): void {
    this.beep(560, 35, 'triangle', 0.025);
  }

  public destroy(): void {
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}

let sharedUi: PlaceholderSound | null = null;

/**
 * A single shared PlaceholderSound for widely-reused, low-stakes UI
 * feedback (button hover, menu navigation) — used by TextButton/MenuNav,
 * which exist in large numbers across every menu screen. Giving each one
 * its own instance would mean an AudioContext per button; this gives
 * every consumer the same lazily-created one instead. Not used for
 * anything gameplay-critical or scene-scoped (those still get their own
 * instance, matching the rest of this project's pattern), since a shared
 * instance has no natural single owner to call destroy() on.
 */
export function sharedUiSound(): PlaceholderSound {
  if (!sharedUi) sharedUi = new PlaceholderSound();
  return sharedUi;
}
