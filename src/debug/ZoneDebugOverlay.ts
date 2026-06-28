import Phaser from 'phaser';
import { DEPTH } from '../config/GameConfig';
import type { Zone } from '../world/Zone';

/**
 * World-space debug visualisation of zone geometry and connections.
 *
 * Toggled by the same backtick key as DebugOverlay (they layer together).
 * Draws filled, semi-transparent rectangles for each zone region type and
 * arrows on the edges where zone connections are declared in ZoneData.
 *
 * Lives in MainScene (not HUDScene) because it draws in world coordinates
 * that scroll with the camera — HUDScene's fixed camera would misplace them.
 * MainScene calls refresh() whenever the active zone changes.
 */
export class ZoneDebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly toggleKey?: Phaser.Input.Keyboard.Key;
  private visible = false;

  // Colour palette (semi-transparent fills, no strokes)
  private static readonly COLORS = {
    water:   { fill: 0x4488ff, alpha: 0.25 },
    fishing: { fill: 0x00ff88, alpha: 0.30 },
    soft:    { fill: 0xffcc00, alpha: 0.20 },
    solid:   { fill: 0xff4444, alpha: 0.25 },
    conn:    { fill: 0xffffff, alpha: 0.80 }
  } as const;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(DEPTH.PLAYER + 5).setVisible(false);

    // Share the backtick toggle with DebugOverlay — both turn on together.
    this.toggleKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
    this.toggleKey?.on('down', () => {
      this.visible = !this.visible;
      this.graphics.setVisible(this.visible);
      this.labels.forEach((l) => l.setVisible(this.visible));
    });
  }

  /**
   * Rebuild the overlay geometry for the current zone.
   * Call once after zone creation / transition — no per-frame cost.
   */
  public refresh(scene: Phaser.Scene, zone: Zone): void {
    this.graphics.clear();
    this.labels.forEach((l) => l.destroy());
    this.labels.length = 0;

    const info = zone.debugInfo();
    const c = ZoneDebugOverlay.COLORS;

    this.drawRects(info.water,   c.water.fill,   c.water.alpha);
    this.drawRects(info.fishing, c.fishing.fill, c.fishing.alpha);
    this.drawRects(info.soft,    c.soft.fill,    c.soft.alpha);
    this.drawRects(info.solid,   c.solid.fill,   c.solid.alpha);

    this.drawConnections(scene, zone);

    // Legend label in top-left world corner
    this.addLabel(scene, 4, 4,
      `[ZONE DEBUG]\nWater ■  Fishing ■  Soft ■  Solid ■  Conn ■`,
      '#aaddff'
    );

    if (!this.visible) {
      this.graphics.setVisible(false);
      this.labels.forEach((l) => l.setVisible(false));
    }
  }

  private drawRects(rects: readonly Phaser.Geom.Rectangle[], color: number, alpha: number): void {
    this.graphics.fillStyle(color, alpha);
    for (const r of rects) {
      this.graphics.fillRect(r.x, r.y, r.width, r.height);
    }
  }

  /**
   * Draw an arrow on each declared zone connection edge so it's obvious
   * where the player will travel to a neighbouring zone.
   */
  private drawConnections(scene: Phaser.Scene, zone: Zone): void {
    const conns = zone.connections;
    if (!conns || conns.length === 0) return;

    const w = zone.widthPx;
    const h = zone.heightPx;
    const c = ZoneDebugOverlay.COLORS.conn;
    const arrowLen = 14;
    const thickness = 3;

    for (const conn of conns) {
      this.graphics.fillStyle(c.fill, c.alpha);
      this.graphics.lineStyle(thickness, c.fill, c.alpha);

      let ax: number, ay: number, bx: number, by: number;
      switch (conn.edge) {
        case 'left':
          ax = 0; ay = h / 2;
          bx = arrowLen; by = h / 2;
          break;
        case 'right':
          ax = w - arrowLen; ay = h / 2;
          bx = w; by = h / 2;
          break;
        case 'top':
          ax = w / 2; ay = 0;
          bx = w / 2; by = arrowLen;
          break;
        case 'bottom':
          ax = w / 2; ay = h - arrowLen;
          bx = w / 2; by = h;
          break;
      }

      this.graphics.strokeLineShape(new Phaser.Geom.Line(ax, ay, bx, by));
      // Arrowhead triangle
      this.drawArrowHead(ax, ay, bx, by, arrowLen * 0.4);

      const labelX = (ax + bx) / 2;
      const labelY = (ay + by) / 2 - 10;
      this.addLabel(scene, labelX, labelY, `→ ${conn.toZone}`, '#ffffff');
    }
  }

  private drawArrowHead(ax: number, ay: number, bx: number, by: number, size: number): void {
    const angle = Math.atan2(by - ay, bx - ax);
    const tip = { x: bx, y: by };
    const left  = { x: bx - size * Math.cos(angle - 0.5), y: by - size * Math.sin(angle - 0.5) };
    const right = { x: bx - size * Math.cos(angle + 0.5), y: by - size * Math.sin(angle + 0.5) };
    this.graphics.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
  }

  private addLabel(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
    const label = scene.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color,
      backgroundColor: '#0b0f14bb',
      padding: { x: 2, y: 1 }
    }).setDepth(DEPTH.PLAYER + 6).setVisible(this.visible);
    this.labels.push(label);
  }

  public destroy(): void {
    this.toggleKey?.removeAllListeners();
    this.graphics.destroy();
    this.labels.forEach((l) => l.destroy());
    this.labels.length = 0;
  }
}
