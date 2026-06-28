import Phaser from 'phaser';
import { StoryFlags, type StoryProgress } from '../../systems/StoryProgress';
import { SaveSystem } from '../../systems/SaveSystem';
import type { Player } from '../../entities/Player';
import type { Zone } from '../../world/Zone';
import type { CombatSystem } from '../../systems/CombatSystem';
import type { FishingSystem } from '../../systems/FishingSystem';
import type { Health } from '../../systems/Health';
import type { FishingHUD } from '../../ui/FishingHUD';
import { VillageNPCs } from '../../world/VillageNPCs';
import type { IntroSequence } from './IntroSequence';
import type { SaveableSystems } from '../../systems/SaveSystem';
import { canonicalZoneId, type ZoneConnection } from '../../data/ZoneData';
import { ENCOUNTERS } from '../../data/CombatData';

export interface JourneyDeps {
  scene: Phaser.Scene;
  player: Player;
  getZone: () => Zone;
  getCurrentZoneId: () => string;
  story: StoryProgress;
  combat: CombatSystem;
  fishing: FishingSystem;
  fishingHUD: FishingHUD;
  notifications: { push: (text: string, variant?: 'info' | 'success' | 'warning') => void };
  playerHealthHUD: { show: () => void };
  playerHealth: Health;
  getIntro: () => IntroSequence | undefined;
  getSaveableSystems: () => SaveableSystems;
  getBoundSaveSlot: () => number | null;
  setBoundSaveSlot: (slot: number) => void;
  transitionToZone: (zoneId: string, opts?: { spawnX?: number; spawnY?: number }) => boolean;
  openShop: () => void;
  startNpcDialogue: (name: string, lines: string[]) => void;
  findDrySpawn: (x: number, y: number) => { x: number; y: number };
}

/**
 * Drives the narrative journey from beach tutorial → slime encounter →
 * village arrival, and handles zone-edge travel and player death/respawn.
 *
 * Extracted from MainScene to give these tightly-related story beats a
 * single owner. MainScene delegates spatial trigger checks, NPC interaction
 * routing, and village lifecycle here; it keeps ownership of zone building,
 * camera transitions, and save slot tracking.
 *
 * Purely event-driven: fires on world state changes, changes no fishing or
 * movement logic, and owns no Phaser physics. The three flags it maintains
 * (slimeEncounterTriggered, hasAttemptedFirstSwing, villageReached) were
 * previously scattered across MainScene's class-level state.
 */
export class JourneyDirector {
  private slimeEncounterTriggered = false;
  private hasAttemptedFirstSwing = true;
  private villageReached = false;
  private villageNPCs?: VillageNPCs;

  constructor(private readonly deps: JourneyDeps) {}

  // ── Public API called by MainScene ────────────────────────────────────

  /**
   * Resume state from a loaded save (called by MainScene after save is
   * applied). Restores the flags that prevent re-triggering cleared story
   * beats.
   */
  public restoreFromSave(): void {
    if (this.deps.story.has(StoryFlags.FIRST_SLIME)) {
      this.slimeEncounterTriggered = true;
    }
  }

  /**
   * Spawn the village on initial load if the save had already reached it
   * (and the player landed in the beach zone). Called once after save is
   * applied, before the first frame.
   */
  public restoreVillageIfNeeded(): void {
    if (
      this.deps.story.has(StoryFlags.REACHED_VILLAGE) &&
      canonicalZoneId(this.deps.getCurrentZoneId()) === 'beach'
    ) {
      this.villageReached = true;
      this.spawnVillage();
    }
  }

  /** Per-frame: check spatial triggers and zone-edge transitions. */
  public update(): void {
    this.checkJourneyTriggers();
    this.villageNPCs?.update(this.deps.player);
    this.deps.getIntro()?.update(this.deps.player);
  }

  /**
   * Route an interact-key press.
   * Priority: village NPCs > intro fisherman.
   * Returns true if an interaction was consumed so MainScene doesn't
   * fall through to other input paths.
   */
  public handleInteract(): boolean {
    const intro = this.deps.getIntro();
    if (this.villageNPCs?.hasInteractable()) {
      const talk = this.villageNPCs.interact();
      if (talk) {
        this.deps.startNpcDialogue(talk.name, talk.lines);
      }
      return true;
    }
    if (intro?.hasInteractable()) {
      intro.interact();
      return true;
    }
    return false;
  }

  /** Called from MainScene when ENCOUNTER_CLEARED fires. */
  public onEncounterCleared(): void {
    this.deps.fishingHUD.flashSystemMessage('Victory! The path is clear. Onward to the village.');
    this.deps.playerHealth.heal(1);
    this.autosave();
  }

  /** Called from MainScene when the player's health reaches zero. */
  public onPlayerDefeated(): void {
    this.deps.fishing.cancel();
    this.deps.player.animator.playDeath();
    const camera = this.deps.scene.cameras.main;
    camera.fadeOut(260, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const zone = this.deps.getZone();
      const spawn = this.deps.findDrySpawn(zone.widthPx / 2, zone.heightPx / 2);
      this.deps.player.setPosition(spawn.x, spawn.y);
      this.deps.playerHealth.restoreFull();
      this.slimeEncounterTriggered = false;
      this.deps.player.animator.respawn();
      camera.fadeIn(260, 0, 0, 0);
      this.deps.fishingHUD.flashSystemMessage('You wake back on the shore, unharmed.');
    });
  }

  /**
   * Tear down village NPCs when the zone changes. Called by MainScene
   * inside transitionToZone before the old zone is destroyed.
   */
  public destroyVillageNPCs(): void {
    this.villageNPCs?.destroy();
    this.villageNPCs = undefined;
  }

  /**
   * Re-populate the beach village after a zone transition back to the
   * beach. Called by MainScene after the new zone is built.
   */
  public restoreVillageAfterTransition(zoneId: string): void {
    if (zoneId === 'beach' && this.villageReached) {
      this.spawnVillage();
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private checkJourneyTriggers(): void {
    const here = canonicalZoneId(this.deps.getCurrentZoneId());
    const zone = this.deps.getZone();

    if (here === 'beach' && this.deps.story.has(StoryFlags.TUTORIAL_DONE)) {
      this.checkSlimeEncounter(zone);
      this.checkVillageGate(zone);
    }

    this.checkZoneEdgeTransitions(here, zone);
  }

  private checkSlimeEncounter(zone: Zone): void {
    if (this.slimeEncounterTriggered) return;
    const slimeGate = zone.widthPx * 0.55;
    if (this.deps.player.x < slimeGate) return;

    this.slimeEncounterTriggered = true;
    this.deps.story.setFlag(StoryFlags.FIRST_SLIME);
    this.deps.playerHealthHUD.show();
    this.hasAttemptedFirstSwing = false;

    const enc = ENCOUNTERS['beach-first-slime'];
    if (enc.hintMessage) {
      this.deps.fishingHUD.flashSystemMessage(enc.hintMessage, enc.hintDurationMs);
    }
    this.deps.combat.startEncounter(
      enc.enemies.map((e) => ({ x: this.deps.player.x + e.dx, y: this.deps.player.y + e.dy }))
    );
  }

  private checkVillageGate(zone: Zone): void {
    if (this.villageReached) return;
    if (!this.deps.story.has(StoryFlags.FIRST_SLIME)) return;
    if (this.deps.combat.isActive) return;

    const villageGate = zone.widthPx * 0.9;
    if (this.deps.player.x < villageGate) return;

    this.onReachVillage();
  }

  private onReachVillage(): void {
    this.villageReached = true;
    this.deps.story.setFlag(StoryFlags.REACHED_VILLAGE);
    this.deps.story.unlockZone('village');
    this.deps.fishingHUD.flashSystemMessage('You reached Riverside Village — a safe haven.');
    this.deps.playerHealth.restoreFull();
    this.spawnVillage();
    this.autosave();
  }

  private spawnVillage(): void {
    if (this.villageNPCs) return;
    const zone = this.deps.getZone();
    const originX = Math.min(zone.widthPx - 30, this.deps.player.x + 30);
    const originY = this.deps.player.y;
    this.villageNPCs = new VillageNPCs(this.deps.scene, originX, originY, {
      onOpenShop: () => this.deps.openShop()
    });
  }

  /**
   * Zone-edge travel driven by the connections declared in each zone's
   * definition. Guarded so it can't fire mid-combat or mid-cast.
   */
  private checkZoneEdgeTransitions(here: string, zone: Zone): void {
    if (this.deps.combat.isActive || this.deps.fishing.isActive) return;

    const connections = zone.connections;
    if (connections) {
      for (const conn of connections) {
        if (conn.requiresUnlock && !this.deps.story.isZoneUnlocked(conn.requiresUnlock)) continue;
        if (this.edgeCrossed(conn.edge, zone)) {
          this.deps.transitionToZone(conn.toZone, conn.spawnHint);
          return;
        }
      }
    } else {
      // Fallback: hardcoded adjacency. Retained only for zones that predate
      // ZoneData connections (none of the active zones as of sprint 1).
      this.checkLegacyEdgeTransitions(here, zone);
    }
  }

  private checkLegacyEdgeTransitions(here: string, zone: Zone): void {
    if (here === 'beach' && this.deps.story.isZoneUnlocked('forest-river')) {
      if (this.deps.player.x >= zone.widthPx - 6) {
        this.deps.transitionToZone('forest-river', { spawnX: 24, spawnY: zone.heightPx / 2 });
      }
    }
    if (here === 'forest-river') {
      if (this.deps.player.x <= 6) {
        this.deps.transitionToZone('beach', { spawnX: zone.widthPx * 0.85, spawnY: zone.heightPx / 2 });
      }
    }
  }

  private edgeCrossed(edge: ZoneConnection['edge'], zone: Zone): boolean {
    const p = this.deps.player;
    switch (edge) {
      case 'left':   return p.x <= 6;
      case 'right':  return p.x >= zone.widthPx  - 6;
      case 'top':    return p.y <= 6;
      case 'bottom': return p.y >= zone.heightPx - 6;
    }
  }

  private autosave(): void {
    const slot = this.deps.getBoundSaveSlot() ?? 0;
    const ok = SaveSystem.save(slot, this.deps.getSaveableSystems());
    this.deps.setBoundSaveSlot(slot);
    if (!ok) {
      this.deps.notifications.push('Auto-save failed — check storage.', 'warning');
    }
  }

  /** True if the player is close enough to the intro fisherman (post-tutorial idle). */
  public get hasAttemptedSwing(): boolean {
    return this.hasAttemptedFirstSwing;
  }

  public markSwingAttempted(): void {
    this.hasAttemptedFirstSwing = true;
  }

  public destroy(): void {
    this.villageNPCs?.destroy();
    this.villageNPCs = undefined;
  }
}

