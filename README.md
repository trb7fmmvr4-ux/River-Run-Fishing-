# River Run Fishing

A cinematic pixel-art adventure RPG built around fishing — TypeScript + Phaser 3.

This is the **project foundation plus the full core loop**: bootstrap,
player movement, camera, input, a placeholder test world, the fishing
cycle (cast → wait → bite → react → result), and the economy that turns
a catch into progress (Cooler → Sell → Gold → Shop). No combat, lodge,
or crafting yet — those come later, in priority order.

## Requirements

- Node.js **20.19+** or **22.12+**
- npm (comes with Node)

## Running it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (typically `http://localhost:5173`).
For phone testing on the same network, Vite also prints a `Network:` URL —
open that on your device instead of `localhost`.

Other commands:

```bash
npm run build      # type-check (tsc --noEmit) + production build to dist/
npm run preview     # preview the production build locally
```

> A note on validation: this was written and carefully reviewed in an
> offline environment, and a `tsc --noEmit` pass confirmed there are no
> syntax or logic errors in the project's own code. That pass couldn't
> resolve the `phaser` package itself (no network access in that sandbox),
> so it could not type-check Phaser API calls specifically. Run
> `npm run build` after `npm install` as your first real check.

## Documentation

- [`docs/ALPHA_STATUS.md`](docs/ALPHA_STATUS.md) — the living, per-sprint
  record of what's actually done, what's known-broken, and what's next.
  This is the most accurate picture of the project's current state.
- [`docs/LAUNCHER_GUIDE.md`](docs/LAUNCHER_GUIDE.md) — how the
  double-click launcher scripts (`Launch River Run Fishing.command` /
  `.bat`) work, for anyone packaging or troubleshooting them.

## What's working right now

> **This section (and "Architecture notes" / "What's next" below) describe
> an early sprint and have not been rewritten to track every system added
> since.** The directory tree above and [`docs/ALPHA_STATUS.md`](docs/ALPHA_STATUS.md)
> are kept current; this prose narrative is not, and re-verifying it
> against current behavior is flagged as a follow-up rather than guessed
> at here.

- Boot → Preload → Main scene flow
- Top-down player movement with acceleration/drag (feels analog, not
  instant-stop)
- Camera that follows the player with light smoothing, clamped to world
  bounds
- Keyboard input (arrow keys or WASD)
- On-screen virtual joystick on touch-capable devices (bottom-left corner)
- A placeholder test world — tiled ground, a border, and some scattered
  decoration — built entirely from generated textures, so the project
  runs with **zero external art assets**
- **Fishing**: a water zone along the east edge of the map. Walk into it
  and press **SPACE** or **E** (or click/tap the on-screen action button,
  bottom-right — it's clickable on desktop too, not just touch) to cast.
  A bobber drops into the water and floats. At some point it'll twitch
  once — that's not the bite, just a tell. When the real bite hits, the
  camera kicks, the bobber dips, and a color-shifting reaction bar
  appears (green → amber → red, blinking in the last quarter) — press
  the button again before it empties to catch the fish. Catching pops
  the bobber up with a burst of sparks scaled to the fish's rarity and a
  matching camera flash; missing sinks it with a duller shake. Placeholder
  beep SFX play on cast/bite/catch/fail (raw WebAudio, no audio files).
  Press the button outside the water and you'll get a "Need to be in the
  water..." message instead of nothing happening.
- **Economy**: every successful catch is deposited into the **Cooler**
  automatically (capacity 10 to start). Press **I** to open it — see
  what you've got, tap **Sell All** to convert it to gold. Press **B**
  to open the **Shop** and spend gold on the one upgrade that exists so
  far: **Expand Cooler (+5)** for 40g. Gold shows top-left at all times,
  along with the control hints. Both panels lock movement and the
  fishing action while open, and neither can be opened mid-cast (so the
  reaction bar is never hidden behind one) — but either can always be
  closed. A general-purpose **Inventory** also exists underneath the
  Cooler in that same panel — it's empty right now since nothing produces
  non-fish items yet, but it's real, working storage, ready for bait or
  crafting materials later.

> **Known pre-existing issue, not introduced this pass:** `VirtualJoystick`
> and `ActionButton` (the touch joystick and action button) use
> `setScrollFactor(0)`, which is a documented Phaser quirk that doesn't
> render correctly under a non-1 camera zoom (this project uses 2x). The
> new Gold/Cooler/Shop UI avoids this by positioning itself in real world
> coordinates that track the camera every frame instead (see
> `ScreenAnchor.ts`) — the same fix would apply cleanly to the joystick
> and action button if/when they're revisited, but that was out of scope
> for this pass (extending the economy, not touching input).

## Project structure

```
src/
  main.ts                    Phaser.Game bootstrap

  config/
    GameConfig.ts            All shared constants: sizes, speeds, camera, depth/z-order,
                              fishing tuning, economy, input flags, UI style guide

  types/
    GameTypes.ts              Shared, engine-agnostic types

  data/                       Pure data, zero Phaser dependency — the only files that
                              need to change to add content
    FishData.ts               Fish table (rarity, value, reaction window, zone/weather/bait prefs)
    ZoneData.ts                Zone table (size, water, fishing areas, species) + legacy id aliasing
    BaitData.ts                 Bait catalogue
    QuestData.ts                 Starter quest chain (objective/reward/prerequisite data)

  entities/
    Player.ts                  Top-down movement, acceleration-based
    PlayerAnimator.ts          Drives the player's directional animation states
    NPCAnimator.ts             Same animation-driving approach, for NPCs
    Slime.ts                   The first enemy: AI + health + death
    HeldEquipmentVisual.ts     Renders whatever tool the player has equipped, in-hand

  scenes/
    BootScene.ts                Engine-level setup, no asset loading
    PreloadScene.ts             Loads/generates everything the game needs, registers art packs
    MainScene.ts                 World scene: player, zone, enemies, NPCs, the zoomed/following
                                 camera, and fishing's world-space parts (bobber, line)
    HUDScene.ts                  Concurrent UI scene: fixed-camera HUD, panels, dialogue, debug overlay
    MenuScene.ts / SettingsScene.ts / CreditsScene.ts   Front-end flow

  systems/
    InputManager.ts             Unifies keyboard + touch into movement/action/panel toggles
    FishingSystem.ts             The cast → wait → bite → react → result state machine
    CombatSystem.ts               Self-contained controller for the first (slime) encounter
    Inventory.ts                  Generic, optionally capacity-limited item storage primitive
    Cooler.ts                      Fish-only Inventory; auto-deposits on FishingEvents.CATCH_SUCCESS
    GoldWallet.ts                   Tracks the gold balance
    Shop.ts                          Sells Cooler contents for gold; buys upgrades
    BaitSystem.ts                     Tracks which bait is currently equipped
    Health.ts                          Player HP, damage, and the post-hit invulnerability window
    Journal.ts                          Persistent catch records / milestones
    Progression.ts                       Player-facing milestone tracking
    QuestSystem.ts                        Tracks live progress against QuestData.ts's definitions
    StoryProgress.ts                       Tutorial flags, zone unlocks, rod tier
    SettingsStore.ts                        Persisted audio/graphics/gameplay settings
    SaveSystem.ts                            3-slot, versioned save/load across every system above
    IntroSequence.ts                         The opening cinematic / rod-handover sequence
    Environment.ts                            Day/night + weather state
    ActionButton.ts / VirtualJoystick.ts       Touch-input fallbacks (off by default, PC-first)
    tools/Tool.ts                              Contract every equippable tool implements
    tools/FishingRodTool.ts                     The fishing rod, as an equippable Tool
    tools/EquipmentManager.ts                    Maps hotbar slots to Tool instances

  debug/
    DebugOverlay.ts             Backtick-toggled FPS/fishing-state/entity-count readout.
                                Isolated here specifically so "never ships visible to a
                                player" is a folder-level fact, not a per-file one.

  ui/
    ScreenLayout.ts              Pure, camera-free screen-space positioning (HUDScene's coordinate system)
    UIAnchor.ts                   The older, camera-aware positioning still used by the
                                   (disabled-by-default) joystick/action button
    UILayout.ts / UIButton.ts / UIAnimations.ts   Shared layout/button/tween-feedback helpers
    FishingHUD.ts                  Bobber, reaction bar, particles, camera fx, sound, message feedback
    GoldHUD.ts / HotbarHUD.ts / PlayerHealthHUD.ts / QuestHUD.ts / EnvironmentHUD.ts   Always-on readouts
    InventoryPanel.ts / ShopPanel.ts / JournalPanel.ts / PauseOverlay.ts   Toggleable panels
    DialogueBox.ts                  NPC conversation UI
    MenuButtons.ts                  On-screen Cooler/Shop menu buttons (off by default)
    theme/                            UI_THEME-driven shared building blocks (ThemePanel, TextButton,
                                      Tooltip, MenuNav, Notifications) — see theme/index.ts

  utils/
    EventBus.ts                  Shared event channel; the only shared singleton in the project
    AssetRegistry.ts              Single front door over all four art packs below
    ArtPack.ts / ArtPack2.ts / ArtPack3.ts / ArtPack4.ts   Per-phase art pack loaders (terrain/water;
                                  fish/gear/loot/creatures; player/NPC/enemy/boss; buildings/UI/decor)
    SpriteSheetFrames.ts            Shared rect-extraction + texture/frame registration core
                                    used by all four art packs above
    PlaceholderTextures.ts          Generates fallback textures with zero art files
    PlaceholderSound.ts              Cast/bite/catch/fail beeps via raw WebAudio, no audio files
    ParticleBurst.ts                  Small celebratory particle effect, reused across catch/combat feedback

  world/
    Zone.ts                       Reads a ZoneDefinition and builds the actual world + collision from it
    VillageNPCs.ts                  Spawns and drives the village's NPCs
```



## Architecture notes

- **Data-driven config**: tunable numbers (speed, zoom, world size, fishing
  timing) live in `GameConfig.ts`, not scattered as magic numbers through
  scene code.
- **No global state**: the only shared singleton is `EventBus`. The fishing
  loop now uses it for real — `FishingSystem` emits `CAST` / `BITE` /
  `CATCH_SUCCESS` / `CATCH_FAILURE`, and `FishingHUD` is the only listener.
  Neither class knows the other exists; a different presentation (or none,
  for a test) could be swapped in without touching `FishingSystem.ts`.
- **Input is source-agnostic**: `Player.applyMovement()` is unchanged —
  it still just takes a normalized `MovementIntent` and doesn't know where
  it came from. `InputManager` now also exposes a single generic
  `isActionJustPressed()` (SPACE or the on-screen button), which fishing
  uses today and later contextual interactions can reuse.
- **Fish are pure data**: `FishData.ts` has zero engine dependencies.
  Adding a new fish — or rebalancing rarity/difficulty — never requires
  touching `FishingSystem.ts`, `FishingHUD.ts`, or any scene code.
- **No art dependency**: water, like everything else, is drawn with
  `Phaser.GameObjects.Graphics`. Swapping in real art later only touches
  `FishingZone.ts` — nothing else references it directly.
- **Feel lives entirely in the presentation layer**: tension tells, the
  reaction-window jitter, screen shake/flash, particles, the bobber, and
  placeholder SFX were all added inside `FishingSystem.ts` and
  `FishingHUD.ts` (plus one new texture and one new sound utility).
  Nothing about movement, the camera's own follow/zoom logic, or the
  scene wiring in `MainScene.ts` changed to support any of it.
- **Rarity now reads visually, with no economy needed**: a fish's
  `rarity` field already existed in `FishData.ts`; it's now also used to
  scale the catch celebration (spark count, flash color) in `FishingHUD.ts`,
  so rarer fish already feel more rewarding to land before Inventory or
  Economy exist.
- **Cooler is an Inventory, not a copy of one**: `Cooler` wraps a private
  `Inventory` instance and adds fish-specific rules (only fish ids, a
  capacity limit, gold values resolved from `FishData.ts`). The general
  `Inventory` class has zero fish-specific knowledge and zero Phaser
  dependency, so it's ready to back a real item inventory later without
  any rework.
- **FishingSystem still doesn't know the economy exists**: `Cooler`
  listens for `FishingEvents.CATCH_SUCCESS` from the outside, exactly
  like `FishingHUD` does. If storage fails because the Cooler is full,
  `Cooler` emits `CoolerEvents.FULL` and `FishingHUD` shows a delayed
  "Cooler full! Lost the catch." message — `FishingSystem.ts` itself
  was not touched to make this work.
- **Shop is the only thing that touches both Cooler and GoldWallet.**
  Selling and buying both flow through it, so gold can never change
  except through one auditable path.
- **Screen-fixed UI uses real world coordinates, not `scrollFactor(0)`**:
  see the zoom callout above. `GoldHUD`, `InventoryPanel`, and `ShopPanel`
  all recompute their position from the camera's current scroll every
  frame via `ScreenAnchor.ts`, and counter-scale by `1 / CAMERA.ZOOM` once
  at creation, so they render at the intended screen position and size
  regardless of zoom.

## What's next

Per the development priority order: a **Journal** with basic progression
tracking (fish caught, gold earned, milestones) — a natural fit now that
there's an economy worth tracking. The pre-existing zoom/`scrollFactor(0)`
issue on the joystick and action button (see above) is also a quick,
worthwhile fix whenever input is back in scope.
