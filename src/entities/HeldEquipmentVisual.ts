import Phaser from 'phaser';
import { DEPTH } from '../config/GameConfig';
import type { Direction } from './PlayerAnimator';

interface HeldItemConfig {
  /** Glyph shown for this tool — swap for a real texture key once art exists; the rest of this system doesn't care which. */
  icon: string;
  /** Per-direction offset from the player's anchor, in local pixels, plus a small tilt so it reads as "held" rather than floating flat. */
  offsets: Record<Direction, { x: number; y: number; rotation: number }>;
}

/**
 * Registry of held-item visuals by Tool id. Adding a new tool (sword,
 * axe, pickaxe, net, bucket, torch) is exactly one entry here — nothing
 * in Player or HeldEquipmentVisual itself needs to change, per the
 * brief's "no additional Player logic" requirement.
 */
const HELD_ITEM_REGISTRY: Record<string, HeldItemConfig> = {
  fishing_rod: {
    icon: '\u{1F3A3}',
    offsets: {
      // y=-4 places the icon at chest/hand level on a 24×32 sprite whose
      // origin is (0.5,0.5) — the old y=-11 landed near the top of the head.
      // 'up' is a pixel or two higher because the sprite's arm reaches back
      // and up when facing away.
      down:  { x: 8,  y: -4, rotation:  0.3 },
      up:    { x: -8, y: -6, rotation: -0.3 },
      left:  { x: -9, y: -4, rotation: -0.5 },
      right: { x: 9,  y: -4, rotation:  0.5 }
    }
  }
};

/**
 * Shows a small icon near the player's hand representing whatever tool
 * is currently equipped — idle/walking/talking/waiting-for-a-bite all
 * lack a held-item depiction in the base character art, so this fills
 * that gap. Hides automatically whenever the active animation pose
 * already depicts the item itself (cast/reel/attack), so it never
 * double-renders alongside the real pose art.
 *
 * "Equipped" here is sticky, not literally "whatever hotbar slot is
 * highlighted": selecting the bait slot (which isn't a Tool at all, just
 * a passive modifier) does NOT hide the rod, since the player hasn't put
 * it away — only a slot that resolves to a *different* Tool does. This
 * matches "the rod only disappears when another tool is equipped."
 */
/**
 * The rod-tip offset for a given facing direction — exported separately
 * from the full registry so other systems that need "where is the rod
 * held" (the fishing line's start point, the cast origin) can share the
 * exact same data the held-item icon uses, rather than each approximating
 * it independently. One source of truth for "where the rod is."
 */
export function getRodTipOffset(direction: Direction): { x: number; y: number } {
  const offset = HELD_ITEM_REGISTRY.fishing_rod.offsets[direction];
  return { x: offset.x, y: offset.y };
}

export class HeldEquipmentVisual {
  private readonly icon: Phaser.GameObjects.Text;
  private currentToolId: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.icon = scene.add
      .text(0, 0, '', { fontSize: '11px' })
      .setOrigin(0.5)
      .setDepth(DEPTH.PLAYER + 1)
      .setVisible(false);
  }

  /**
   * Called whenever the equipped tool might have changed (e.g. on hotbar
   * selection). Only updates the displayed tool if the new selection
   * actually resolves to a real Tool — a passive slot (bait) leaves
   * whatever was last equipped showing, per the class doc above.
   */
  public setEquippedTool(toolId: string | undefined): void {
    if (toolId) this.currentToolId = toolId;
  }

  /** Clear entirely — e.g. on respawn/death, or if a future "unequip" action is added. */
  public clear(): void {
    this.currentToolId = null;
  }

  public update(
    player: { x: number; y: number },
    animator: { currentDirection: Direction; poseShowsHeldItem: boolean; isAnimated: boolean }
  ): void {
    const config = this.currentToolId ? HELD_ITEM_REGISTRY[this.currentToolId] : undefined;
    if (!config || !animator.isAnimated || animator.poseShowsHeldItem) {
      this.icon.setVisible(false);
      return;
    }

    const offset = config.offsets[animator.currentDirection];
    this.icon.setText(config.icon);
    this.icon.setPosition(player.x + offset.x, player.y + offset.y);
    this.icon.setRotation(offset.rotation);
    this.icon.setVisible(true);
  }

  public destroy(): void {
    this.icon.destroy();
  }
}
