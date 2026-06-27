# River Run Fishing — Alpha Status

_Last updated: end of the "Project Foundation & Long-Term Scalability" pass (Sprint 3)._
_This file should be updated at the end of every future sprint so it always reflects the real state of the project._

---

## ⚠ Critical environment limitation (read this first)

**The development environment used for this entire project has no real browser access, and this sprint additionally had no access to the `phaser` npm package itself** (the registry request for it was blocked by the sandbox's network policy; a `tsc --noEmit` pass against the project's own logic was not possible this sprint for files that import Phaser). Every change this sprint was verified by direct code reading — confirming each refactor preserves the exact texture keys, event names, and control flow of the code it replaced — rather than by compilation. **Running `npm install && npm run build` is the first real check, exactly as prior sprints have also required.**

## This sprint: foundation work, no gameplay change

This sprint was scoped as pure engineering hygiene ahead of continued content growth — explicitly no gameplay, balance, or save-format changes. Three real, evidence-backed gaps were found and closed:

- **Quest data is now data.** `FishData.ts`, `ZoneData.ts`, and `BaitData.ts` all lived in `src/data/`, engine-free, with systems reading them — except quest definitions, which lived inline inside `QuestSystem.ts` itself, the one exception to an otherwise consistent project convention. `STARTER_QUESTS` and its supporting types now live in `src/data/QuestData.ts`, matching the others exactly. `QuestSystem.ts` is now purely the runtime that tracks progress against whatever quest table it's given — no behavior changed, only where the table lives.
- **Four art-pack loaders shared one copy-pasted core.** `ArtPack.ts` / `ArtPack2.ts` / `ArtPack3.ts` / `ArtPack4.ts` (Phase 1–4 art) each independently reimplemented the same "slice rects out of a loaded sheet into a fresh addressable texture" logic, including an identical three-way ternary for resolving animated-vs-static frame rects, copy-pasted across three of the four files verbatim. That core now lives once in `src/utils/SpriteSheetFrames.ts`; all four loaders call into it. Every external API (`queue`, `register`, `key`/`*Key` helpers) and every registered texture key is unchanged — `AssetRegistry.ts`, which composes all four, needed zero edits.
- **Debug tooling now has its own home.** `DebugOverlay.ts` moved from `src/ui/` into a new `src/debug/` folder, matching the sprint brief's suggested layout and making "this code never ships in a build a player should see" a folder-level fact rather than something to remember about one file. While there, it gained a second readout — a live entity count (currently: alive slimes in the active combat encounter) — following the exact same "scene pushes one number in per frame" pattern the existing FPS/fishing-state readout already used, so this is additive and doesn't change how the overlay is opened (backtick), nor anything about gameplay.

See **Files Modified / New Files** in this sprint's delivery summary for the full list and the reasoning behind each change, including what was deliberately left alone and why.

## Completed Systems

- **Core loop**: fishing → cooler → sell → gold → shop upgrades.
- **Save/load**: 3-slot, versioned. Unaffected by this sprint — confirmed by reading `SaveSystem.ts`'s `saveableSystems()`, which references system/data objects only; none of the files touched this sprint are on that list.
- **HUDScene**: owns GoldHUD, HotbarHUD, PlayerHealthHUD, QuestHUD, EnvironmentHUD, InventoryPanel, ShopPanel, JournalPanel, PauseOverlay, Notifications, the NPC dialogue box, and the (now relocated) DebugOverlay. Launched alongside MainScene, stopped explicitly when MainScene shuts down.
- **Equipment architecture**: `EquipmentManager` takes a *lazy getter* for the hotbar rather than a direct reference, because the hotbar lives in a different Scene than the code that constructs `EquipmentManager` — resolved only at the moment a tool is actually used, never assumed to exist at construction time.
- **Pause/Settings flow**: Settings is launched with a `'PAUSE'` sentinel (not a real scene key) so its Back button knows to stop itself and reveal the paused game, rather than restarting the main menu.
- **Data-driven content tables**: fish (`FishData.ts`), zones (`ZoneData.ts`), bait (`BaitData.ts`), and now quests (`QuestData.ts`) are all plain data with zero engine dependency — adding new content to any of them touches no system code.
- **Art pipeline**: four phased art packs (terrain/water/nature/effects; fish/gear/loot/creatures; player/NPC/enemy/boss animation; buildings/decor/UI/expansion) load through one shared registration core, composed by `AssetRegistry.ts`.
- Combat, NPCs, collision, environment, progression, journal, intro sequence: unchanged this sprint.

## Known Bugs

- Unresolved, unverifiable without a browser: the same standing item from prior sprints. No new bugs were introduced or found this sprint (no gameplay code was touched).

## Technical Debt

- `ActionButton`/`VirtualJoystick` still use the old camera-aware `UIAnchor` — deliberate, predates this sprint. They're disabled by default.
- No formal collision-category enum.
- No Map system.
- `README.md`'s "Project structure" section describes an early-sprint file layout (`TestWorld.ts`, `FishingZone.ts`, `ScreenAnchor.ts`, etc.) that no longer matches `src/`. Updated this sprint (see delivery summary) — the directory tree is now accurate, but the longer feature-narrative sections above it were intentionally left as-is; verifying every gameplay claim in them against current behavior is a content-accuracy task, not an architecture one, and is called out as a suggested follow-up.
- `Shop.ts`'s upgrade list and `CombatSystem.ts`'s encounter tuning are still inline/local data (one upgrade, one encounter type) rather than external tables — evaluated this sprint and deliberately left alone; see delivery summary for why moving them now would be a premature abstraction.
- `assets/art`, `art2`, `art3`, `art4` numbering looks unconventional at a glance but is a deliberate 1:1 mirror of `ArtPack`/`ArtPack2`/`ArtPack3`/`ArtPack4` — evaluated this sprint, left alone; renaming would break that mirroring for no organizational gain.

## Current Alpha Priorities

1. **A real browser playtest.** Still the single highest-priority next step, and still true after this sprint, which touched no gameplay code — this is about the project overall, not specific to any one pass.
2. Resolve the Map situation.
3. Fishing/combat feel passes.

## Beta Priorities

- A second real tool.
- Formal collision categories.
- A real attachment-point system for visible equipment.

## Future Ideas (not current work)

- Crafting, housing, multiplayer, additional zones.

## Last Playtest Summary

No real-browser playtest has ever been performed on this project.

## Overall Alpha Readiness

See the development report accompanying this sprint.



