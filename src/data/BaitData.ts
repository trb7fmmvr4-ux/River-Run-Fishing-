export interface BaitDefinition {
  id: string;
  name: string;
  /** Short flavor description for UI. */
  description: string;
  /**
   * Optional rarity-tier hint (higher = fancier bait). Not gameplay-critical
   * yet; reserved for future shop pricing / unlock gating.
   */
  tier?: number;
}

/**
 * Bait catalogue. Bait ids are the same free-form item ids the inventory
 * and quest rewards already use (e.g. 'bait_worm'), so bait integrates with
 * the existing item store with no new plumbing. Fish reference these ids via
 * `preferredBait` in FishData to bias selection.
 *
 * Expandable: add an entry here (and optionally reference it from fish) and
 * it flows through the bait system, inventory, and selection automatically.
 */
export const BAIT_TABLE: BaitDefinition[] = [
  { id: 'bait_none', name: 'No Bait', description: 'Fishing bare-hooked. Anything might bite.', tier: 0 },
  { id: 'bait_worm', name: 'Worm', description: 'Classic all-rounder. Common fish love it.', tier: 1 },
  { id: 'bait_minnow', name: 'Minnow', description: 'Small baitfish; tempts larger predators.', tier: 1 },
  { id: 'bait_cricket', name: 'Cricket', description: 'Surface-twitchy; good in clear weather.', tier: 1 },
  { id: 'bait_shiny_lure', name: 'Shiny Lure', description: 'Flashy metal; draws rare, curious fish.', tier: 2 },
  { id: 'bait_legendary_lure', name: 'Legendary Lure', description: 'Whispered to call the uncatchable.', tier: 3 }
];

export const BAIT_BY_ID = new Map(BAIT_TABLE.map((b) => [b.id, b]));

/** The "no bait" id, used as the default equipped bait. */
export const NO_BAIT_ID = 'bait_none';

export function getBait(id: string): BaitDefinition | undefined {
  return BAIT_BY_ID.get(id);
}
