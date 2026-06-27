import type { Tool } from './Tool';
import type { HotbarHUD } from '../../ui/HotbarHUD';

/**
 * Maps hotbar slot indices to Tool instances and exposes one entry point —
 * `useEquipped()` — for "Left Mouse was pressed." This is the seam between
 * input and gameplay the brief asked for: MainScene calls `useEquipped()`
 * without knowing or caring what's equipped; this class looks up whichever
 * slot the hotbar currently has selected and delegates to that tool's
 * own `use()`.
 *
 * A slot with nothing registered (e.g. the bait slot, which is a passive
 * equip rather than a left-click-triggered tool) safely no-ops — that's a
 * deliberate distinction, not a bug: bait modifies fishing automatically
 * in the background, it isn't "used" the way a rod/sword/axe is.
 *
 * Adding a new tool to a slot is exactly one `equip()` call; nothing else
 * in the input pipeline needs to know it exists.
 *
 * Takes a SUPPLIER function for the hotbar, not a direct reference,
 * resolved lazily on each `useEquipped()` call rather than once at
 * construction. HotbarHUD now lives in a separate, concurrently-launched
 * Scene (HUDScene); rather than assume Phaser processes `scene.launch()`
 * synchronously (which may or may not be true depending on Phaser
 * internals this project can't verify without a browser), every access
 * is deferred until the moment it's actually needed — by which point
 * gameplay is running and both scenes are unquestionably fully alive.
 */
export class EquipmentManager {
  private readonly tools = new Map<number, Tool>();

  constructor(private readonly getHotbar: () => HotbarHUD) {}

  /** Register a tool for a given hotbar slot (0-based). */
  public equip(slotIndex: number, tool: Tool): void {
    this.tools.set(slotIndex, tool);
  }

  /** The tool currently selected on the hotbar, if any. */
  public get equippedTool(): Tool | undefined {
    return this.tools.get(this.getHotbar().selectedSlot);
  }

  /** Call on "use" input (Left Mouse). Delegates to whatever tool occupies the selected slot. */
  public useEquipped(): void {
    this.equippedTool?.use();
  }
}
