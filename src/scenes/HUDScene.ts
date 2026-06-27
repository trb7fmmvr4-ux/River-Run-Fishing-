import Phaser from 'phaser';
import { GoldHUD } from '../ui/GoldHUD';
import { HotbarHUD } from '../ui/HotbarHUD';
import { PlayerHealthHUD } from '../ui/PlayerHealthHUD';
import { QuestHUD } from '../ui/QuestHUD';
import { EnvironmentHUD } from '../ui/EnvironmentHUD';
import { InventoryPanel } from '../ui/InventoryPanel';
import { ShopPanel } from '../ui/ShopPanel';
import { JournalPanel } from '../ui/JournalPanel';
import { DialogueBox } from '../ui/DialogueBox';
import { PauseOverlay } from '../ui/PauseOverlay';
import { Notifications } from '../ui/theme/Notifications';
import { Tooltip } from '../ui/theme/Tooltip';
import { DebugOverlay } from '../debug/DebugOverlay';
import type { GoldWallet } from '../systems/GoldWallet';
import type { StoryProgress } from '../systems/StoryProgress';
import type { BaitSystem } from '../systems/BaitSystem';
import type { Inventory } from '../systems/Inventory';
import type { Cooler } from '../systems/Cooler';
import type { Shop } from '../systems/Shop';
import type { Progression } from '../systems/Progression';
import type { Health } from '../systems/Health';
import type { QuestSystem } from '../systems/QuestSystem';
import type { Journal } from '../systems/Journal';
import type { Environment } from '../systems/Environment';

export interface HUDSceneData {
  goldWallet: GoldWallet;
  story: StoryProgress;
  bait: BaitSystem;
  inventory: Inventory;
  cooler: Cooler;
  shop: Shop;
  progression: Progression;
  playerHealth: Health;
  quests: QuestSystem;
  journal: Journal;
  environment: Environment;
  onResume: () => void;
  onQuitToMenu: () => void;
}

/**
 * HUDScene — every piece of pure screen-space UI, running in its own
 * Phaser Scene alongside MainScene.
 *
 * This is the architectural fix for a UI-positioning problem that
 * persisted across many rounds of patching. The old approach kept all UI
 * inside MainScene and fought its zoomed/scrolling camera by recomputing
 * every element's world position every frame so it would *render* at the
 * right screen position — correct math (verified repeatedly), but a
 * fragile pattern: every single panel had to get that per-frame
 * conversion right, forever, with no structural guard against one being
 * wrong.
 *
 * HUDScene's camera is never zoomed and never scrolled — nothing in this
 * file ever calls setZoom or startFollow. That means every UI element in
 * here can use a fixed screen coordinate, set once, and it is simply
 * correct, permanently, regardless of what MainScene's camera is doing.
 * There is no conversion to get right because there is no transform to
 * convert through. This doesn't patch the old bug class — it removes the
 * category of bug entirely.
 *
 * Scenes render in launch order, so launching this AFTER MainScene means
 * it draws on top automatically (the same mechanism already proven by
 * SettingsScene launching on top of a paused MainScene).
 *
 * Communication with MainScene: MainScene gets a typed reference via
 * `this.scene.get(SCENE_KEYS.HUD) as HUDScene` and calls/reads this
 * scene's public fields directly (isOpen flags, toggle methods, etc).
 * Cross-cutting concerns (gold changing, a quest completing) continue to
 * flow through the existing global EventBus, unchanged — only direct,
 * scene-local position math has been removed.
 *
 * Tooltip ownership: this scene owns exactly ONE Tooltip instance and
 * hands it to every HUD that wants hover text. Previously four separate
 * HUDs (GoldHUD, EnvironmentHUD, HotbarHUD, InventoryPanel) each created
 * their own — duplicated GameObjects doing the identical job, none of
 * which could ever be visible at the same time as another (a pointer can
 * only hover one thing), and each requiring its own per-frame `update()`
 * call here just to track the cursor. Sharing one instance removed that
 * whole category of "remember to wire this HUD's tooltip into the update
 * loop" maintenance risk — this scene's own update() below is now a
 * single line instead of a growing list.
 */
export class HUDScene extends Phaser.Scene {
  public goldHUD!: GoldHUD;
  public hotbar!: HotbarHUD;
  public playerHealthHUD!: PlayerHealthHUD;
  public questHUD!: QuestHUD;
  public environmentHUD!: EnvironmentHUD;
  public inventoryPanel!: InventoryPanel;
  public shopPanel!: ShopPanel;
  public journalPanel!: JournalPanel;
  public npcDialogue!: DialogueBox;
  public pauseOverlay!: PauseOverlay;
  public notifications!: Notifications;
  public debugOverlay!: DebugOverlay;
  private tooltip!: Tooltip;

  constructor() {
    super('HUDScene');
  }

  public create(data: HUDSceneData): void {
    this.tooltip = new Tooltip(this);

    this.goldHUD = new GoldHUD(this, data.goldWallet, this.tooltip, data.story);
    this.hotbar = new HotbarHUD(this, this.tooltip, data.story, data.bait);
    this.playerHealthHUD = new PlayerHealthHUD(this, data.playerHealth);
    this.questHUD = new QuestHUD(this, data.quests);
    this.environmentHUD = new EnvironmentHUD(this, data.environment, this.tooltip);
    this.inventoryPanel = new InventoryPanel(
      this,
      data.inventory,
      data.cooler,
      data.shop,
      this.tooltip,
      data.bait,
      data.progression
    );
    this.shopPanel = new ShopPanel(this, data.shop);
    this.journalPanel = new JournalPanel(this, data.journal);
    this.npcDialogue = new DialogueBox(this);
    this.notifications = new Notifications(this);
    this.pauseOverlay = new PauseOverlay(this, {
      onResume: data.onResume,
      onQuitToMenu: data.onQuitToMenu
    });
    this.debugOverlay = new DebugOverlay(this);

    // This scene's own shutdown (stopped explicitly by MainScene when
    // MainScene itself shuts down — see MainScene.handleShutdown) cleans
    // up everything created above.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    // Explicit, unambiguous readiness signal. `scene.launch()` queues this
    // scene's own create() for the *next* update tick — it does not run
    // synchronously inside the caller's create() — so MainScene cannot
    // safely dereference any field on `this` (goldHUD, hotbar, etc.)
    // immediately after calling scene.launch(). Anything in MainScene that
    // needs a fully-constructed HUDScene waits for this event instead.
    this.events.emit('hud-create-complete');
  }

  public update(): void {
    // The shared tooltip is the only thing left with genuine per-frame
    // state (tracking the live pointer position while visible). Every
    // other element here was positioned once and never needs to move
    // again, and no individual HUD owns a tooltip to wire in anymore.
    this.tooltip.update();
    this.debugOverlay.update();
  }

  private handleShutdown(): void {
    this.goldHUD?.destroy();
    this.hotbar?.destroy();
    this.playerHealthHUD?.destroy();
    this.questHUD?.destroy();
    this.environmentHUD?.destroy();
    this.inventoryPanel?.destroy();
    this.shopPanel?.destroy();
    this.journalPanel?.destroy();
    this.npcDialogue?.destroy();
    this.pauseOverlay?.destroy();
    this.notifications?.destroy();
    this.debugOverlay?.destroy();
    this.tooltip?.destroy();
  }
}
