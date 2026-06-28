import type { InputManager } from '../../systems/InputManager';
import type { FishingSystem } from '../../systems/FishingSystem';
import type { PlaceholderSound } from '../../utils/PlaceholderSound';

interface ManagedPanels {
  inventoryPanel: { isOpen: boolean; toggle: () => void };
  shopPanel:      { isOpen: boolean; toggle: () => void };
  journalPanel:   { isOpen: boolean; toggle: () => void };
}

/**
 * Enforces the single-panel-at-a-time rule and mid-cast gating for all
 * toggleable UI panels (Inventory, Shop, Journal).
 *
 * Previously this logic lived as three separate toggle methods scattered
 * through MainScene. Extracting it here makes the rules explicit and
 * testable, and removes ~40 lines from MainScene with no change in
 * behaviour.
 *
 * Rules:
 *  - Only one panel may be open at a time.
 *  - A panel cannot be OPENED (but can always be closed) while a cast is
 *    active — the reaction bar must stay visible so the player can respond.
 *  - A click sound plays on every successful toggle.
 */
export class UIPanelController {
  constructor(
    private readonly panels: ManagedPanels,
    private readonly fishing: Pick<FishingSystem, 'isActive'>,
    private readonly sound: PlaceholderSound
  ) {}

  /** True if any managed panel is currently open. */
  public get anyOpen(): boolean {
    return this.panels.inventoryPanel.isOpen ||
           this.panels.shopPanel.isOpen ||
           this.panels.journalPanel.isOpen;
  }

  /** Called each frame from MainScene.update() to handle keyboard toggle inputs. */
  public handleToggles(input: InputManager): void {
    if (input.isInventoryToggleJustPressed()) this.toggleInventory();
    if (input.isShopToggleJustPressed()) this.toggleShop();
  }

  public toggleInventory(): void {
    if (this.panels.shopPanel.isOpen) return;
    if (!this.panels.inventoryPanel.isOpen && this.fishing.isActive) return;
    this.sound.playClick();
    this.panels.inventoryPanel.toggle();
  }

  public toggleShop(): void {
    if (this.panels.inventoryPanel.isOpen) return;
    if (!this.panels.shopPanel.isOpen && this.fishing.isActive) return;
    this.sound.playClick();
    this.panels.shopPanel.toggle();
  }

  public toggleJournal(): void {
    if (!this.panels.journalPanel.isOpen) {
      if (this.fishing.isActive) return;
      if (this.panels.inventoryPanel.isOpen) this.panels.inventoryPanel.toggle();
      if (this.panels.shopPanel.isOpen) this.panels.shopPanel.toggle();
    }
    this.sound.playClick();
    this.panels.journalPanel.toggle();
  }
}
