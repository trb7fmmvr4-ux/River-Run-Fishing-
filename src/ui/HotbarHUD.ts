import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, UI_THEME } from '../config/GameConfig';
import { createBusSubscription } from '../utils/EventBus';
import type { StoryProgress } from '../systems/StoryProgress';
import { StoryEvents } from '../systems/StoryProgress';
import type { BaitSystem } from '../systems/BaitSystem';
import { BaitEvents } from '../systems/BaitSystem';
import { BAIT_TABLE, getBait } from '../data/BaitData';
import { PlaceholderSound } from '../utils/PlaceholderSound';
import { Tooltip } from './theme/Tooltip';

const SLOT_SIZE = 28;
const SLOT_GAP = 6;
const MARGIN_BOTTOM = 14;

/**
 * Always-visible hotbar, bottom-center of the screen. Two slots reflect
 * the game's actual equippable things — the rod (always equipped; its
 * tier is shown) and the current bait — rather than inventing item types
 * that don't exist yet.
 *
 * Lives in HUDScene (never zoomed/scrolled), so every slot's position is
 * computed once, here, with plain fixed-screen arithmetic — no per-frame
 * layout pass needed.
 *
 * Design note on Space/Left-Click: fishing/combat has its own carefully-
 * tuned input handling, and this class deliberately does not touch it.
 * Selecting a hotbar slot (1/2 or mouse wheel) only changes which slot is
 * *highlighted*. The bait slot's action (cycling to the next bait) fires
 * from clicking the slot directly.
 */
export class HotbarHUD {
  private readonly story?: StoryProgress;
  private readonly bait?: BaitSystem;
  private readonly sound: PlaceholderSound;
  private readonly subscriptions = createBusSubscription();

  private readonly slotBg: Phaser.GameObjects.Rectangle[] = [];
  private readonly slotHighlight: Phaser.GameObjects.Rectangle[] = [];
  private readonly slotIcon: Phaser.GameObjects.Text[] = [];
  private readonly slotKeyLabel: Phaser.GameObjects.Text[] = [];
  private readonly slotStatus: Phaser.GameObjects.Text[] = [];

  private selected = 0;
  private readonly slotCount = 2;

  /** The currently highlighted hotbar slot (0-based) — what EquipmentManager treats as "equipped". */
  public get selectedSlot(): number {
    return this.selected;
  }

  /** `tooltip` is shared, owned by HUDScene — see GoldHUD's constructor doc for why this isn't created here. */
  constructor(scene: Phaser.Scene, tooltip: Tooltip, story?: StoryProgress, bait?: BaitSystem) {
    this.story = story;
    this.bait = bait;
    this.sound = new PlaceholderSound();

    const totalWidth = this.slotCount * SLOT_SIZE + (this.slotCount - 1) * SLOT_GAP;
    const rowStartX = GAME_WIDTH / 2 - totalWidth / 2 + SLOT_SIZE / 2;
    const slotY = GAME_HEIGHT - MARGIN_BOTTOM - SLOT_SIZE / 2;

    for (let i = 0; i < this.slotCount; i++) {
      const slotX = rowStartX + i * (SLOT_SIZE + SLOT_GAP);

      const bg = scene.add
        .rectangle(slotX, slotY, SLOT_SIZE, SLOT_SIZE, UI_THEME.color.dark, 0.78)
        .setStrokeStyle(1, UI_THEME.color.panelEdge, 0.9)
        .setDepth(DEPTH.HUD_GOLD)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.onSlotClicked(i));
      if (i === 0) {
        tooltip.attach(bg, () => {
          const tier = this.story ? Math.max(1, this.story.rod || 1) : 1;
          return `Fishing Rod (Tier ${tier})\nLeft Click to cast/swing.`;
        });
      } else if (i === 1 && this.bait) {
        tooltip.attach(bg, () => {
          const current = getBait(this.bait!.equippedId);
          return current ? `${current.name}\n${current.description}` : 'Click to cycle bait.';
        });
      }

      const highlight = scene.add
        .rectangle(slotX, slotY, SLOT_SIZE + 4, SLOT_SIZE + 4)
        .setStrokeStyle(2, UI_THEME.color.gold, 1)
        .setDepth(DEPTH.HUD_GOLD - 1)
        .setVisible(false);

      const icon = scene.add
        .text(slotX, slotY - 2, '', {
          fontFamily: UI_THEME.font.family,
          fontSize: UI_THEME.font.body,
          color: UI_THEME.hex.white,
          align: 'center'
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.HUD_GOLD + 1);

      const keyLabel = scene.add
        .text(slotX + SLOT_SIZE / 2 - 2, slotY + SLOT_SIZE / 2 - 2, String(i + 1), {
          fontFamily: UI_THEME.font.family,
          fontSize: UI_THEME.font.tiny,
          color: UI_THEME.hex.slate
        })
        .setOrigin(1, 1)
        .setDepth(DEPTH.HUD_GOLD + 1);

      const status = scene.add
        .text(slotX, slotY - SLOT_SIZE / 2 - 10, '', {
          fontFamily: UI_THEME.font.family,
          fontSize: UI_THEME.font.tiny,
          color: UI_THEME.hex.mint
        })
        .setOrigin(0.5, 0)
        .setDepth(DEPTH.HUD_GOLD + 1);

      this.slotBg.push(bg);
      this.slotHighlight.push(highlight);
      this.slotIcon.push(icon);
      this.slotKeyLabel.push(keyLabel);
      this.slotStatus.push(status);
    }

    this.refresh();
    this.setSelected(0);

    if (this.story) this.subscriptions.on(StoryEvents.CHANGED, this.refresh, this);
    if (this.bait) this.subscriptions.on(BaitEvents.CHANGED, this.refresh, this);
  }

  /** True if a slot at this index is actually rendered (so number-key input can no-op for unused slots, per spec: "if slot empty, nothing happens"). */
  public slotExists(index: number): boolean {
    return index >= 0 && index < this.slotCount;
  }

  /** The screen position of a slot's center — used to animate an item icon flying into the hotbar. */
  public getSlotScreenPosition(index: number): { x: number; y: number } | null {
    const bg = this.slotBg[index];
    return bg ? { x: bg.x, y: bg.y } : null;
  }

  /** A brief scale-pulse (100% → 120% → 100%) to draw attention to a slot — e.g. when an item is first placed there. */
  public flashSlot(index: number, durationMs = 250): void {
    const bg = this.slotBg[index];
    const highlight = this.slotHighlight[index];
    const icon = this.slotIcon[index];
    if (!bg) return;
    const targets = [bg, highlight, icon].filter(Boolean);
    bg.scene.tweens.add({
      targets,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: durationMs / 2,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
  }

  /** Select a slot by index (0-based) — clamps to the valid range. Visual only; see class doc. */
  public setSelected(index: number): void {
    this.selected = Phaser.Math.Wrap(index, 0, this.slotCount);
    for (let i = 0; i < this.slotCount; i++) {
      this.slotHighlight[i].setVisible(i === this.selected);
    }
  }

  /** Move the selection by a number of slots (e.g. ±1 for mouse wheel). */
  public cycleSelected(delta: number): void {
    this.setSelected(this.selected + delta);
  }

  private onSlotClicked(index: number): void {
    this.setSelected(index);
    if (index === 1 && this.bait) {
      this.sound.playConfirm();
      const ids = BAIT_TABLE.map((b) => b.id);
      const idx = ids.indexOf(this.bait.equippedId);
      this.bait.equip(ids[(idx + 1) % ids.length]);
    }
  }

  private refresh(): void {
    // Slot 0: the rod, always equipped — shows current tier.
    const tier = this.story ? Math.max(1, this.story.rod || 1) : 1;
    this.slotIcon[0].setText('\u{1F3A3}'); // fishing pole glyph
    this.slotStatus[0].setText(`Tier ${tier}`);

    // Slot 1: current bait.
    if (this.bait) {
      const short = this.bait.equippedName.split(' ')[0].slice(0, 6);
      this.slotIcon[1].setText('\u2022');
      this.slotStatus[1].setText(short);
    }
  }

  public destroy(): void {
    this.subscriptions.dispose();
    this.slotBg.forEach((o) => o.destroy());
    this.slotHighlight.forEach((o) => o.destroy());
    this.slotIcon.forEach((o) => o.destroy());
    this.slotKeyLabel.forEach((o) => o.destroy());
    this.slotStatus.forEach((o) => o.destroy());
    this.sound.destroy();
  }
}
