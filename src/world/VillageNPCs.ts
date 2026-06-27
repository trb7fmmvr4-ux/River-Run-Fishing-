import Phaser from 'phaser';
import { DEPTH, UI_THEME } from '../config/GameConfig';
import { ArtRegistry } from '../utils/AssetRegistry';

interface VillageNpcDef {
  npcId: string;
  name: string;
  lines: string[];
  /** Optional action when the player interacts (e.g. open shop). */
  onInteract?: () => void;
  offsetX: number;
  offsetY: number;
}

interface SpawnedNpc {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  def: VillageNpcDef;
  prompt: Phaser.GameObjects.Text;
}

/**
 * Spawns the first village's residents (Phase 6): a Shopkeeper, a
 * Fisherman, and a Villager, as visible standing characters near the
 * village gate. Each shows a floating name; walking close reveals an
 * interact prompt, and pressing the action key runs their behaviour
 * (the shopkeeper opens the existing shop panel via the callback).
 *
 * Additive and self-contained: it spawns sprites and reads player
 * position; it owns no gameplay rules beyond the interaction callbacks the
 * scene supplies. Marks the village as a tangible place without needing a
 * separate zone/transition system yet (Phase 7 keeps that as data-only
 * architecture).
 */
export class VillageNPCs {
  private readonly scene: Phaser.Scene;
  private readonly npcs: SpawnedNpc[] = [];
  private readonly interactRange = 26;
  private nearby: SpawnedNpc | null = null;

  constructor(scene: Phaser.Scene, originX: number, originY: number, callbacks: { onOpenShop: () => void }) {
    this.scene = scene;

    const defs: VillageNpcDef[] = [
      {
        npcId: 'merchant',
        name: 'Shopkeeper',
        lines: ['Fresh gear and fair prices!', 'Sell me your catch any time.'],
        onInteract: callbacks.onOpenShop,
        offsetX: 0,
        offsetY: -10
      },
      {
        npcId: 'old_fisherman',
        name: 'Fisherman',
        lines: ['The river has been generous lately.', 'Rest here — the village is safe.'],
        offsetX: 34,
        offsetY: 10
      },
      {
        npcId: 'villager_a',
        name: 'Villager',
        lines: ['Welcome to Riverside!', 'You made it past the slimes? Impressive.'],
        offsetX: -32,
        offsetY: 12
      }
    ];

    for (const def of defs) {
      this.spawn(def, originX + def.offsetX, originY + def.offsetY);
    }
  }

  private spawn(def: VillageNpcDef, x: number, y: number): void {
    const key = ArtRegistry.npc(def.npcId, 'idle', 'down');
    const sprite = this.scene.textures.exists(key)
      ? this.scene.add.image(x, y, key, 0)
      : this.scene.add.rectangle(x, y, 12, 20, UI_THEME.color.slate) as unknown as Phaser.GameObjects.Image;
    sprite.setOrigin(0.5, 1).setDepth(DEPTH.PLAYER - 0.05);

    const label = this.scene.add
      .text(x, y - 30, def.name, {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.tiny,
        color: UI_THEME.hex.gold,
        stroke: UI_THEME.hex.dark,
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.PLAYER + 1);

    const prompt = this.scene.add
      .text(x, y - 40, '[E]', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.tiny,
        color: UI_THEME.hex.white,
        stroke: UI_THEME.hex.dark,
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.PLAYER + 1)
      .setVisible(false);

    this.npcs.push({ sprite, label, def, prompt });
  }

  /** Per-frame: highlight the nearest interactable NPC in range. */
  public update(player: Phaser.GameObjects.Components.Transform): void {
    const px = player.x;
    const py = player.y;
    let best: SpawnedNpc | null = null;
    let bestDist = this.interactRange;
    for (const npc of this.npcs) {
      const d = Phaser.Math.Distance.Between(px, py, npc.sprite.x, npc.sprite.y);
      npc.prompt.setVisible(false);
      if (d < bestDist) {
        bestDist = d;
        best = npc;
      }
    }
    this.nearby = best;
    if (best) best.prompt.setVisible(true);
  }

  /** True if the player is next to an NPC (so the scene can route the action press). */
  public hasInteractable(): boolean {
    return this.nearby !== null;
  }

  /** Run the nearby NPC's interaction. Returns the dialogue lines to show, if any. */
  public interact(): { name: string; lines: string[] } | null {
    if (!this.nearby) return null;
    const def = this.nearby.def;
    if (def.onInteract) {
      def.onInteract();
      return null; // shopkeeper opens a panel instead of talking
    }
    return { name: def.name, lines: def.lines };
  }

  public destroy(): void {
    for (const npc of this.npcs) {
      npc.sprite.destroy();
      npc.label.destroy();
      npc.prompt.destroy();
    }
    this.npcs.length = 0;
  }
}
