/**
 * Central, static configuration for River Run Fishing.
 *
 * Anything that is a "tunable number" or "shared constant" belongs here
 * rather than being hard-coded inside scenes or entities. This keeps the
 * project data-driven and makes it easy to slot in future systems (fish
 * tables, zones, items) without touching engine/bootstrap code.
 */

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MENU: 'MenuScene',
  SETTINGS: 'SettingsScene',
  CREDITS: 'CreditsScene',
  MAIN: 'MainScene',
  HUD: 'HUDScene'
} as const;

export const TEXTURE_KEYS = {
  PLAYER: 'tex-player',
  GROUND_TILE: 'tex-ground-tile',
  BOBBER: 'tex-bobber'
} as const;

export const WORLD = {
  TILE_SIZE: 16,
  WIDTH_IN_TILES: 60,
  HEIGHT_IN_TILES: 40
} as const;

export const PLAYER = {
  SIZE: 12,
  MAX_SPEED: 110, // px/sec
  ACCELERATION: 900, // px/sec^2
  DRAG: 1000, // px/sec^2, applied when there is no input
  SPRINT_MULTIPLIER: 1.2 // applied to MAX_SPEED while Shift is held (reduced from 1.6 - felt too fast for comfortable exploration)
} as const;

export const CAMERA = {
  LERP: 0.08,
  ZOOM: 2
} as const;

/**
 * Centralized render-layer ordering. Every setDepth() call in the project
 * references one of these instead of a bare number, so the stacking order
 * is described in one place and new layers can be slotted in without
 * hunting for magic numbers across files. Values preserve the original
 * literals exactly; only their *names* are new.
 */
export const DEPTH = {
  GROUND: 0,
  WATER: 0.5,
  DECORATION: 1,
  BOBBER: 9,
  PLAYER: 10,
  TOUCH_CONTROLS: 1000, // world joystick / action button
  HUD_BACKDROP: 1099,
  HUD: 1100, // floating message text + reaction bar
  HUD_PARTICLES: 1150, // catch sparks, above the HUD text
  HUD_GOLD: 1200, // always-on gold readout
  PANEL: 2000 // modal panels (inventory, shop); panel text/buttons use PANEL + 1/+2
} as const;

export const FISHING = {
  ZONE_WIDTH: 220,
  MIN_WAIT_MS: 1200, // shortest possible time between cast and bite
  MAX_WAIT_MS: 3200, // longest possible time between cast and bite
  RESULT_DISPLAY_MS: 1500, // how long the catch/fail result holds before returning to idle
  REACTION_JITTER_MIN: 0.85, // the reaction window is scaled by a random factor in this range...
  REACTION_JITTER_MAX: 1.15, // ...so the same fish never gives an identical window twice
  TREMOR_MIN_WAIT_MS: 800, // only worth a "false tell" tremor if the wait is at least this long
  TREMOR_MIN_FRACTION: 0.3, // a tremor lands somewhere between 30%...
  TREMOR_MAX_FRACTION: 0.7 // ...and 70% of the way through the wait
} as const;

export const ECONOMY = {
  STARTING_GOLD: 0,
  COOLER_STARTING_CAPACITY: 10
} as const;

/**
 * Combat tuning constants. Centralised here so balance tweaks — rod reach,
 * swing cooldown, slime speed — are one-stop changes rather than hunts
 * through entity and system files.
 *
 * Note: Phaser Arcade physics has no bitmask collision categories (that is
 * a Matter.js feature). Overlap/collider registrations in CombatSystem are
 * the project's collision-filtering mechanism; body sizes live here so they
 * can be tuned alongside the gameplay numbers they interact with.
 */
export const COMBAT = {
  /** Starter rod damage per swing. */
  ROD_DAMAGE: 1,
  /** Hitbox reach of a rod swing in px (radius from player centre). */
  ROD_REACH: 22,
  /** Extra reach tolerance added when checking if a slime is within range. */
  ROD_REACH_TOLERANCE: 8,
  /** Minimum ms between rod swings. */
  SWING_COOLDOWN_MS: 380,
  /** Knockback impulse applied to the player on enemy contact (px/s added). */
  PLAYER_KNOCKBACK: 120,
  /** Camera shake magnitude on player hit. */
  CAMERA_SHAKE: 0.004,
  /** Camera shake duration on player hit (ms). */
  CAMERA_SHAKE_MS: 120,
  /** Delay between last slime death and ENCOUNTER_CLEARED event (ms). */
  CLEARED_DELAY_MS: 400,

  SLIME: {
    /** Default slime hit points. */
    HP: 3,
    /** Default movement speed (px/s). */
    SPEED: 34,
    /** Default contact damage dealt to the player. */
    TOUCH_DAMAGE: 1,
    /** Aggro range — slime starts chasing when player enters this radius. */
    AGGRO_RANGE: 90,
    /** Physics body size (width, height) in px. */
    BODY_W: 12,
    BODY_H: 10,
    /** Duration of the white hit-flash tint (ms). */
    HIT_FLASH_MS: 80
  }
} as const;

export const DEBUG = {
  SHOW_PHYSICS_BODIES: false
} as const;

/**
 * Input configuration.
 *
 * The on-screen virtual joystick is disabled for the desktop testing pass,
 * but the VirtualJoystick class and all its wiring remain intact — flip
 * this flag back to `true` (or make it device-aware) to re-enable mobile
 * touch movement with no other code changes. The on-screen action button
 * is independent and always available as a click/tap fallback.
 */
export const INPUT = {
  ENABLE_VIRTUAL_JOYSTICK: false,
  /** The on-screen "use equipped item" fallback circle (bottom-right). PC-first: off by default, but the class and wiring stay fully intact for a future mobile pass. */
  ENABLE_ACTION_BUTTON: false,
  /** Show the on-screen Cooler/Shop menu buttons. Keyboard I/B always work regardless of this flag. PC-first: off by default. */
  ENABLE_ONSCREEN_MENU_BUTTONS: false
} as const;

/**
 * UI STYLE GUIDE (single source of truth).
 *
 * Every menu/panel should pull its colours, spacing, and type sizes from
 * here so the whole game looks consistent and future UI matches by
 * construction. Colours are the canonical palette already used across the
 * HUD (gold/dark/mint/rarity), expressed as both numbers (for Graphics /
 * shape fills) and hex strings (for Text styles).
 *
 * This is additive: existing panels keep their current literals; new UI
 * (menus, settings, save) is built against these tokens, and future panels
 * should be too.
 */
export const UI_THEME = {
  color: {
    gold: 0xf4c170,
    goldDark: 0x8a611f,
    dark: 0x0b0f14,
    panel: 0x11161d,
    panelEdge: 0x2a3340,
    mint: 0x8cffb0,
    red: 0xff5d5d,
    blue: 0x7fd9ff,
    slate: 0x9fb3c8,
    white: 0xffffff,
    rare: 0xffd27f,
    legendary: 0xffb1f4,
    exotic: 0xff7ce0
  },
  hex: {
    gold: '#f4c170',
    goldDark: '#8a611f',
    dark: '#0b0f14',
    mint: '#8cffb0',
    red: '#ff5d5d',
    blue: '#7fd9ff',
    slate: '#9fb3c8',
    white: '#ffffff',
    muted: '#bfcbd6'
  },
  font: {
    family: 'monospace',
    title: '40px',
    heading: '16px',
    body: '12px',
    small: '10px',
    tiny: '9px'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 40
  },
  panel: {
    fillAlpha: 0.92,
    radius: 6,
    borderWidth: 2
  }
} as const;
