import Phaser from 'phaser';
import { DEPTH, UI_THEME } from '../config/GameConfig';
import { createBusSubscription } from '../utils/EventBus';
import { edge } from './ScreenLayout';
import {
  EnvironmentEvents,
  timeOfDayLabel,
  weatherLabel,
  type Environment,
  type TimeOfDay,
  type Weather
} from '../systems/Environment';
import { Tooltip } from './theme/Tooltip';

const MARGIN = 8;

/** Tiny glyphs so the indicator reads at a glance without art assets. */
const TIME_GLYPH: Record<TimeOfDay, string> = {
  morning: '\u2600',  // sun
  day: '\u2600',
  evening: '\u263D',  // crescent
  night: '\u263E'
};
const WEATHER_GLYPH: Record<Weather, string> = {
  clear: '\u2600',    // sun
  cloudy: '\u2601',   // cloud
  rain: '\u2614',     // umbrella/rain
  storm: '\u26A1',    // bolt
  fog: '\u2248'       // approx waves = haze
};
const TIME_COLOR: Record<TimeOfDay, string> = {
  morning: UI_THEME.hex.gold,
  day: UI_THEME.hex.white,
  evening: UI_THEME.hex.gold,
  night: UI_THEME.hex.blue
};

/**
 * Top-center clock + weather indicator.
 *
 * Reads the Environment system and refreshes on its events. Lives in
 * HUDScene — fixed screen position, set once. Text-with-glyph, so it
 * needs no art and degrades gracefully. Hovering either line explains
 * what it means and why it matters (weather/time bias which fish bite).
 */
export class EnvironmentHUD {
  private readonly environment: Environment;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly weatherText: Phaser.GameObjects.Text;
  private readonly subscriptions = createBusSubscription();

  /** `tooltip` is shared, owned by HUDScene — see GoldHUD's constructor doc for why this isn't created here. */
  constructor(scene: Phaser.Scene, environment: Environment, tooltip: Tooltip) {
    this.environment = environment;

    this.panel = scene.add.graphics().setDepth(DEPTH.HUD_GOLD);

    const timePos = edge('top', 0, MARGIN);
    this.timeText = scene.add
      .text(timePos.x, timePos.y, '', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.small,
        color: UI_THEME.hex.white,
        stroke: UI_THEME.hex.dark,
        strokeThickness: 3
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.HUD_GOLD)
      .setInteractive({ useHandCursor: false });

    const weatherPos = edge('top', 0, MARGIN + 11);
    this.weatherText = scene.add
      .text(weatherPos.x, weatherPos.y, '', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.small,
        color: UI_THEME.hex.slate,
        stroke: UI_THEME.hex.dark,
        strokeThickness: 3
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.HUD_GOLD)
      .setInteractive({ useHandCursor: false });

    tooltip.attach(this.timeText, () => `${timeOfDayLabel(this.environment.time)}\nTime of day affects which fish bite.`);
    tooltip.attach(this.weatherText, () => `${weatherLabel(this.environment.currentWeather)}\nWeather affects which fish bite.`);

    this.subscriptions.on(EnvironmentEvents.CHANGED, this.refresh, this);
    this.refresh();
  }

  private refresh(): void {
    const t = this.environment.time;
    const w = this.environment.currentWeather;
    this.timeText.setText(`${TIME_GLYPH[t]} ${timeOfDayLabel(t)}`);
    this.timeText.setColor(TIME_COLOR[t]);
    this.weatherText.setText(`${WEATHER_GLYPH[w]} ${weatherLabel(w)}`);
  }

  public destroy(): void {
    this.subscriptions.dispose();
    this.panel.destroy();
    this.timeText.destroy();
    this.weatherText.destroy();
  }
}
