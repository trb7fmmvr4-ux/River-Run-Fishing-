import Phaser from 'phaser';
import { DEPTH, UI_THEME } from '../config/GameConfig';
import { EventBus } from '../utils/EventBus';
import { center, fitSize } from './ScreenLayout';
import { JournalEvents } from '../systems/Journal';
import type { Journal, JournalRecord } from '../systems/Journal';

const PANEL_DEPTH = DEPTH.PANEL;
const COLUMN_GAP = 14;

/**
 * Toggleable Fish Journal (press J).
 *
 * Lists every species with discovery status; for discovered fish it shows
 * times caught, largest weight/length, and (compactly, on the same line)
 * where/when/in-what-weather it was first found. Undiscovered fish read as
 * "???" so there's a collection goal. Header shows overall completion and
 * legendary progress.
 *
 * Rendered in two columns so all ~20+ species fit on screen without
 * overflowing the panel. Lives in HUDScene — every element positioned
 * once at a fixed screen coordinate; no per-frame layout pass.
 */
export class JournalPanel {
  private readonly journal: Journal;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly header: Phaser.GameObjects.Text;
  private readonly bodyLeft: Phaser.GameObjects.Text;
  private readonly bodyRight: Phaser.GameObjects.Text;
  private readonly panelWidth: number;
  private readonly panelHeight: number;
  private open = false;

  constructor(scene: Phaser.Scene, journal: Journal) {
    this.journal = journal;

    // Desired size, clamped to the design resolution — can never overflow.
    const fit = fitSize(340, 220);
    this.panelWidth = fit.width;
    this.panelHeight = fit.height;

    const c = center();
    this.background = scene.add.graphics().setPosition(c.x, c.y).setDepth(PANEL_DEPTH).setVisible(false);
    this.drawBackground();

    const headerPos = center(0, -this.panelHeight / 2 + 10);
    this.header = scene.add
      .text(headerPos.x, headerPos.y, '', {
        fontFamily: UI_THEME.font.family,
        fontSize: UI_THEME.font.small,
        color: UI_THEME.hex.gold,
        align: 'center'
      })
      .setOrigin(0.5, 0)
      .setDepth(PANEL_DEPTH)
      .setVisible(false);

    const bodyStyle = {
      fontFamily: UI_THEME.font.family,
      fontSize: UI_THEME.font.tiny,
      color: UI_THEME.hex.white,
      align: 'left' as const,
      lineSpacing: 3
    };

    const leftOffsetX = -this.panelWidth / 2 + 12;
    const columnWidth = this.panelWidth / 2 - 12 - COLUMN_GAP / 2;
    const rightOffsetX = leftOffsetX + columnWidth + COLUMN_GAP;
    const bodyTopOffsetY = -this.panelHeight / 2 + 28;

    const leftPos = center(leftOffsetX, bodyTopOffsetY);
    this.bodyLeft = scene.add
      .text(leftPos.x, leftPos.y, '', bodyStyle)
      .setOrigin(0, 0)
      .setDepth(PANEL_DEPTH)
      .setVisible(false);

    const rightPos = center(rightOffsetX, bodyTopOffsetY);
    this.bodyRight = scene.add
      .text(rightPos.x, rightPos.y, '', bodyStyle)
      .setOrigin(0, 0)
      .setDepth(PANEL_DEPTH)
      .setVisible(false);

    EventBus.on(JournalEvents.CHANGED, this.refresh, this);
  }

  public get isOpen(): boolean {
    return this.open;
  }

  public toggle(): void {
    this.open = !this.open;
    this.setVisible(this.open);
    if (this.open) {
      this.refresh();
    }
  }

  private setVisible(visible: boolean): void {
    this.background.setVisible(visible);
    this.header.setVisible(visible);
    this.bodyLeft.setVisible(visible);
    this.bodyRight.setVisible(visible);
  }

  private drawBackground(): void {
    const g = this.background;
    const w = this.panelWidth;
    const h = this.panelHeight;
    g.clear();
    g.fillStyle(UI_THEME.color.dark, 0.6);
    g.fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, UI_THEME.panel.radius);
    g.fillStyle(UI_THEME.color.panel, UI_THEME.panel.fillAlpha);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, UI_THEME.panel.radius);
    g.lineStyle(UI_THEME.panel.borderWidth, UI_THEME.color.legendary, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, UI_THEME.panel.radius);
  }

  /** One compact line per species: name, catch stats, and (if known) discovery conditions. */
  private formatLine(fish: { name: string }, record: JournalRecord | undefined): string {
    if (!record) return '??? (undiscovered)';
    const ctx: string[] = [];
    if (record.zoneDiscovered) ctx.push(record.zoneDiscovered);
    if (record.timeDiscovered) ctx.push(record.timeDiscovered);
    if (record.weatherDiscovered) ctx.push(record.weatherDiscovered);
    const ctxPart = ctx.length > 0 ? `  [${ctx.join('/')}]` : '';
    return `${fish.name} x${record.timesCaught} ${record.largestWeightKg}kg/${record.largestLengthCm}cm${ctxPart}`;
  }

  private refresh(): void {
    if (!this.open) return;

    const s = this.journal.stats();
    this.header.setText(
      `FISH JOURNAL   ${s.discovered}/${s.totalSpecies}  (${s.completionPct}%)   ` +
      `Legendary ${s.legendaryDiscovered}/${s.legendaryTotal}`
    );

    const entries = this.journal.allRecords();
    const lines = entries.map(({ fish, record }) => this.formatLine(fish, record));

    // Split into two columns so the full roster fits without overflowing
    // the panel, however many species are discovered.
    const half = Math.ceil(lines.length / 2);
    this.bodyLeft.setText(lines.slice(0, half).join('\n'));
    this.bodyRight.setText(lines.slice(half).join('\n'));
  }

  public destroy(): void {
    EventBus.off(JournalEvents.CHANGED, this.refresh, this);
    this.background.destroy();
    this.header.destroy();
    this.bodyLeft.destroy();
    this.bodyRight.destroy();
  }
}
