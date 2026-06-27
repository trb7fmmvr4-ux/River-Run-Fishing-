/**
 * The contract every equippable tool implements.
 *
 * This is the seam the brief asked for: the input system only ever calls
 * `use()` on whatever tool is currently equipped — it has no idea what a
 * rod, sword, axe, or pickaxe actually does. Adding a new tool means
 * writing a new class that implements this interface and registering it
 * with EquipmentManager; nothing in MainScene or InputManager changes.
 */
export interface Tool {
  /** Stable identifier, used for hotbar display and save data if it's ever needed. */
  readonly id: string;
  /** Display name for hotbar/UI purposes. */
  readonly name: string;
  /** Called once per "use" press (Left Mouse) while this tool is equipped. */
  use(): void;
}
