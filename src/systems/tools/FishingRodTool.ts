import type { Tool } from './Tool';
import type { FishingSystem } from '../FishingSystem';
import type { CombatSystem } from '../CombatSystem';

/**
 * The fishing rod, as an equippable Tool.
 *
 * This is exactly where the input-conflict bug used to live: previously,
 * MainScene's action handler decided externally whether a press meant
 * "attack" or "cast" via an if/else chain, and a press that meant to
 * attack but found no target in reach would fall through into fishing
 * and show "Need to be in the water..." — a fishing message, while the
 * player was trying to fight. Moving that decision INSIDE the tool fixes
 * it structurally: the rod is the one thing that knows it can do two
 * things, and it's the only thing that decides between them. No other
 * system competes for this input anymore.
 *
 * No existing FishingSystem/CombatSystem logic changed — this only
 * relocates the decision of *which* of the two to call.
 */
export class FishingRodTool implements Tool {
  public readonly id = 'fishing_rod';
  public readonly name = 'Fishing Rod';

  constructor(
    private readonly fishingSystem: FishingSystem,
    private readonly combat: CombatSystem,
    private readonly canFishHere: () => boolean
  ) {}

  public use(): void {
    if (this.combat.isActive && this.combat.hasTargetInReach()) {
      this.combat.trySwing();
      return;
    }
    this.fishingSystem.handleActionPress(this.canFishHere());
  }
}
