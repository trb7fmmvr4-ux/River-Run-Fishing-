import Phaser from 'phaser';
import { DEPTH, TEXTURE_KEYS, WORLD } from '../config/GameConfig';
import { ArtRegistry } from '../utils/AssetRegistry';
import type { TileRect, ZoneConnection, ZoneDefinition } from '../data/ZoneData';

export interface ZoneBuildResult {
  widthPx: number;
  heightPx: number;
}

/** Collider name tag so a zone can find and remove exactly its own water colliders on teardown. */
const ZONE_WATER_COLLIDER = 'zone-water-collider';

/**
 * Runtime representation of a single explorable zone.
 *
 * Reads a (pure-data) ZoneDefinition and builds the actual world from it:
 * ground, water visuals, decorations, and — importantly — the static
 * physics bodies that make water blocked terrain. It also answers the
 * spatial queries the rest of the game needs ("can the player stand
 * here?", "can they fish from here?") so that logic lives with the zone
 * data rather than being hardcoded in the scene.
 *
 * This is the scalable, data-driven path that all zones build on. Tile
 * coords in the definition are converted to pixels here, once.
 */
export class Zone {
  private readonly definition: ZoneDefinition;
  private readonly waterPx: Phaser.Geom.Rectangle[];
  private readonly fishingPx: Phaser.Geom.Rectangle[];
  /**
   * Solid (non-water) blockers — currently populated by large nature
   * sprites (trees, big rocks) so they actually stop the player instead of
   * being walkable like floor tiles. Collided the same way as water (see
   * enableWaterCollision), so future solid object types just push a rect
   * here and get blocking for free with no new collision plumbing.
   */
  private readonly solidPx: Phaser.Geom.Rectangle[] = [];
  /**
   * SOFT-collision zones — bushes and tall grass. Unlike solidPx, these are
   * never given a physics collider (the player must be able to walk
   * through them); instead `isInSoftZone()` is queried each frame so the
   * caller can apply a movement-speed penalty while standing inside one.
   */
  private readonly softPx: Phaser.Geom.Rectangle[] = [];
  private waterColliders: Phaser.Physics.Arcade.StaticBody[] = [];

  // Everything build() creates is tracked here so the zone can tear itself
  // down cleanly when the player transitions to a different zone. Purely
  // additive bookkeeping — it doesn't change what gets built, only lets us
  // destroy it later without leaking sprites, timers, or colliders.
  private created: Phaser.GameObjects.GameObject[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private colliderObjects: Phaser.GameObjects.GameObject[] = [];

  public readonly widthPx: number;
  public readonly heightPx: number;

  constructor(definition: ZoneDefinition) {
    this.definition = definition;
    this.widthPx = definition.widthInTiles * WORLD.TILE_SIZE;
    this.heightPx = definition.heightInTiles * WORLD.TILE_SIZE;
    this.waterPx = definition.water.map((r) => Zone.tileRectToPx(r));
    this.fishingPx = definition.fishingAreas.map((r) => Zone.tileRectToPx(r));
  }

  public get id(): string {
    return this.definition.id;
  }

  public get name(): string {
    return this.definition.name;
  }

  public get connections(): ZoneConnection[] | undefined {
    return this.definition.connections;
  }

  /** Builds all visuals for the zone and returns its pixel dimensions. */
  public build(scene: Phaser.Scene): ZoneBuildResult {
    const ground = scene.add.tileSprite(0, 0, this.widthPx, this.heightPx, TEXTURE_KEYS.GROUND_TILE);
    ground.setOrigin(0, 0);
    ground.setDepth(DEPTH.GROUND);
    ground.setTint(this.definition.backgroundColor);
    this.created.push(ground);

    this.drawWater(scene);
    this.drawBorder(scene);
    this.scatterDecorations(scene);

    return { widthPx: this.widthPx, heightPx: this.heightPx };
  }

  /**
   * Tears down everything this zone created (sprites, graphics, animation
   * timers, and water colliders), so a different zone can be built in its
   * place without leaks. Safe to call multiple times. Additive: the build
   * path is unchanged; this just disposes what build() tracked.
   */
  public destroy(scene: Phaser.Scene): void {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];

    for (const obj of this.colliderObjects) obj.destroy();
    this.colliderObjects = [];
    this.waterColliders = [];

    for (const obj of this.created) obj.destroy();
    this.created = [];

    // Drop any physics colliders that referenced this zone's blockers.
    // (The blocker GameObjects are destroyed above; this clears the now-dead
    // collider pairs so they don't linger in the world's collider list.)
    scene.physics.world.colliders.getActive()
      .filter((c: Phaser.Physics.Arcade.Collider) => c.name === ZONE_WATER_COLLIDER)
      .forEach((c: Phaser.Physics.Arcade.Collider) => scene.physics.world.removeCollider(c));
  }

  /**
   * Creates invisible static collision bodies over the water AND any solid
   * decorations (large trees/rocks, tracked in solidPx during decoration
   * scatter) so the player physically cannot walk through either. Call
   * after the player exists; pass the player so the collider can be
   * registered here, keeping all blocking-terrain concerns inside the Zone.
   * Method name kept as-is (water collision predates solid objects) so the
   * three existing call sites in MainScene need no changes.
   *
   * `onSolidBump` (optional) fires only for the solid-object colliders, not
   * the water ones — water contact happens constantly during normal
   * fishing-from-shore, so giving it the same "you bumped something"
   * feedback would be noisy and wrong; bumping a tree/rock is the actual
   * "blocked" moment worth a sound/flash.
   */
  public enableWaterCollision(
    scene: Phaser.Scene,
    player: Phaser.Physics.Arcade.Sprite,
    onSolidBump?: () => void
  ): void {
    const addBlocker = (rect: Phaser.Geom.Rectangle, bump: boolean) => {
      // A zero-alpha rectangle given a static body; it's invisible but
      // physically solid. Origin (0,0) so the body lines up with the
      // rectangle's top-left, matching how the source sprite/area is placed.
      const blocker = scene.add.rectangle(rect.x, rect.y, rect.width, rect.height);
      blocker.setOrigin(0, 0);
      scene.physics.add.existing(blocker, true);
      const body = blocker.body as Phaser.Physics.Arcade.StaticBody;
      this.waterColliders.push(body);
      this.colliderObjects.push(blocker);
      const collider = scene.physics.add.collider(player, blocker, bump ? () => onSolidBump?.() : undefined);
      // Tag so destroy() can find and remove exactly this zone's colliders.
      collider.name = ZONE_WATER_COLLIDER;
    };

    for (const rect of this.waterPx) addBlocker(rect, false);
    for (const rect of this.solidPx) addBlocker(rect, true);
  }

  /** True if the point is inside any water rectangle (i.e. blocked). */
  public isWater(x: number, y: number): boolean {
    return this.waterPx.some((rect) => rect.contains(x, y));
  }

  /** True if this point is inside a SOFT-collision zone (bush/tall grass) — caller should apply a speed penalty, not block movement. */
  public isInSoftZone(x: number, y: number): boolean {
    return this.softPx.some((rect) => rect.contains(x, y));
  }

  /** True if the player may cast from this point (inside a fishing area, and not in water). */
  public canFishFrom(x: number, y: number): boolean {
    if (this.isWater(x, y)) return false;
    return this.fishingPx.some((rect) => rect.contains(x, y));
  }

  /** Snapshot of zone geometry for debug visualisation only. */
  public debugInfo(): {
    water: readonly Phaser.Geom.Rectangle[];
    fishing: readonly Phaser.Geom.Rectangle[];
    soft: readonly Phaser.Geom.Rectangle[];
    solid: readonly Phaser.Geom.Rectangle[];
  } {
    return {
      water:   this.waterPx,
      fishing: this.fishingPx,
      soft:    this.softPx,
      solid:   this.solidPx
    };
  }

  private drawWater(scene: Phaser.Scene): void {
    if (this.waterPx.length === 0) return;

    // Prefer the real water art, tiled from standalone per-frame textures
    // (extracted by the registry so they wrap cleanly). If absent, fall
    // back to the original hand-drawn graphics below (identical to before).
    const firstFrameKey = ArtRegistry.waterTile('river', 0);
    if (scene.textures.exists(firstFrameKey)) {
      this.drawWaterSprites(scene);
      return;
    }

    const water = scene.add.graphics();
    water.setDepth(DEPTH.WATER);
    this.created.push(water);
    for (const rect of this.waterPx) {
      water.fillStyle(0x2a6f8e, 0.88);
      water.fillRect(rect.x, rect.y, rect.width, rect.height);

      water.lineStyle(1, 0x6fc3e0, 0.35);
      for (let lineY = rect.y + 6; lineY < rect.y + rect.height; lineY += 10) {
        water.lineBetween(rect.x + 4, lineY, rect.x + rect.width - 4, lineY);
      }

      water.lineStyle(2, 0x163b4a, 0.9);
      water.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  /**
   * Tiles the real water texture across each water rect and cycles its
   * frames for a subtle animated shimmer. Uses the registry's standalone
   * per-frame water textures (which tile cleanly). Purely visual — the
   * collision bodies (enableWaterCollision) are unaffected.
   */
  private drawWaterSprites(scene: Phaser.Scene): void {
    const type = 'river';
    const frameKeys: string[] = [];
    for (let f = 0; f < 4; f++) {
      const key = ArtRegistry.waterTile(type, f);
      if (scene.textures.exists(key)) frameKeys.push(key);
    }
    if (frameKeys.length === 0) return;

    for (const rect of this.waterPx) {
      const water = scene.add.tileSprite(rect.x, rect.y, rect.width, rect.height, frameKeys[0]);
      water.setOrigin(0, 0);
      water.setDepth(DEPTH.WATER);
      this.created.push(water);

      if (frameKeys.length > 1) {
        let frame = 0;
        const timer = scene.time.addEvent({
          delay: 240,
          loop: true,
          callback: () => {
            frame = (frame + 1) % frameKeys.length;
            water.setTexture(frameKeys[frame]);
          }
        });
        this.timers.push(timer);
      }
    }
  }

  private drawBorder(scene: Phaser.Scene): void {
    const border = scene.add.graphics();
    border.lineStyle(4, 0x16323a, 0.9);
    border.strokeRect(2, 2, this.widthPx - 4, this.heightPx - 4);
    border.setDepth(DEPTH.DECORATION);
    this.created.push(border);
  }

  private scatterDecorations(scene: Phaser.Scene): void {
    // Seeded per-zone so each zone looks stable across reloads but
    // distinct from the others.
    const rng = new Phaser.Math.RandomDataGenerator([`river-run-zone-${this.definition.id}`]);

    const treeKey = ArtRegistry.nature('tree');
    const pineKey = ArtRegistry.nature('pine_tree');
    const rockKey = ArtRegistry.nature('large_rock');
    const smallRockKey = ArtRegistry.nature('small_rock');
    const bushKey = ArtRegistry.nature('bush');
    const hasNatureArt = scene.textures.exists(treeKey) && scene.textures.exists(rockKey);

    if (hasNatureArt) {
      this.scatterNatureSprites(scene, rng, { treeKey, pineKey, rockKey, smallRockKey, bushKey });
      return;
    }

    // Fallback: the original drawn grass/rock dabs (unchanged).
    const decorations = scene.add.graphics();
    decorations.setDepth(DEPTH.DECORATION);
    this.created.push(decorations);

    const grassCount = Math.round((this.widthPx * this.heightPx) / 4300);
    for (let i = 0; i < grassCount; i++) {
      const x = rng.between(8, this.widthPx - 8);
      const y = rng.between(8, this.heightPx - 8);
      if (this.isWater(x, y)) continue; // don't scatter grass on water
      decorations.fillStyle(0x2f5d3a, 0.5);
      decorations.fillCircle(x, y, rng.between(1, 2));
    }

    const rockCount = Math.round(grassCount / 6);
    for (let i = 0; i < rockCount; i++) {
      const x = rng.between(16, this.widthPx - 16);
      const y = rng.between(16, this.heightPx - 16);
      if (this.isWater(x, y)) continue;
      decorations.fillStyle(0x5b5b63, 1);
      decorations.fillCircle(x, y, rng.between(3, 5));
      decorations.fillStyle(0x37373d, 1);
      decorations.fillCircle(x + 1, y + 1, rng.between(2, 3));
    }
  }

  /**
   * Places real nature sprites (trees, rocks, bushes) on dry land, with
   * a small margin away from the water so trunks don't overlap the
   * shoreline. Depth-sorted by y so closer props draw in front. Density is
   * tuned down from the dab-scatter since each sprite is much larger.
   *
   * Trees and large rocks get a modest solid footprint (tracked in
   * solidPx, collided in enableWaterCollision) so they actually block
   * movement; bushes and small decorative rocks stay purely visual and
   * remain passable, per design.
   */
  private scatterNatureSprites(
    scene: Phaser.Scene,
    rng: Phaser.Math.RandomDataGenerator,
    keys: { treeKey: string; pineKey: string; rockKey: string; smallRockKey: string; bushKey: string }
  ): void {
    const area = this.widthPx * this.heightPx;
    const treeCount = Math.round(area / 14000);
    const rockCount = Math.round(area / 22000);
    const bushCount = Math.round(area / 18000);

    const placeAwayFromWater = (margin: number): { x: number; y: number } | null => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = rng.between(12, this.widthPx - 12);
        const y = rng.between(12, this.heightPx - 12);
        if (this.isWater(x, y)) continue;
        // keep a margin clear of water edges
        if (this.isWater(x + margin, y) || this.isWater(x - margin, y)) continue;
        return { x, y };
      }
      return null;
    };

    const addSprite = (key: string, x: number, y: number, footprint: 'none' | 'solid' | 'soft' = 'none') => {
      // Frame 0 = the asset's crop within the packed nature sheet. Without
      // it, the default __BASE frame would render the entire sheet.
      const s = scene.add.image(x, y, key, 0);
      s.setOrigin(0.5, 1); // anchor at base so it "stands" on the ground
      // Depth by y so lower (closer) sprites overlap higher ones, but stay
      // above ground/water and below the player's gameplay depth.
      s.setDepth(DEPTH.DECORATION + y / 10000);
      this.created.push(s);

      if (footprint === 'solid') {
        // A modest footprint under the sprite's base — a trunk/rock-sized
        // area, not its full leafy width — so the player collides with
        // "the tree" without the hitbox feeling oversized. Origin is
        // (0.5, 1), so (x, y) is the sprite's bottom-center point.
        const fw = Math.max(8, s.displayWidth * 0.4);
        const fh = Math.max(6, s.displayHeight * 0.25);
        this.solidPx.push(new Phaser.Geom.Rectangle(x - fw / 2, y - fh, fw, fh));
      } else if (footprint === 'soft') {
        // A wider zone roughly matching the bush's visible canopy — slows
        // the player while standing in it, but never blocks.
        const fw = Math.max(10, s.displayWidth * 0.7);
        const fh = Math.max(8, s.displayHeight * 0.5);
        this.softPx.push(new Phaser.Geom.Rectangle(x - fw / 2, y - fh, fw, fh));
      }
      return s;
    };

    for (let i = 0; i < treeCount; i++) {
      const pos = placeAwayFromWater(18);
      if (!pos) continue;
      const key = rng.frac() < 0.5 ? keys.treeKey : keys.pineKey;
      addSprite(scene.textures.exists(key) ? key : keys.treeKey, pos.x, pos.y, 'solid');
    }
    for (let i = 0; i < bushCount; i++) {
      const pos = placeAwayFromWater(8);
      if (!pos || !scene.textures.exists(keys.bushKey)) continue;
      // Bushes stay passable (per design: slow, don't block) — soft footprint.
      addSprite(keys.bushKey, pos.x, pos.y, 'soft');
    }
    for (let i = 0; i < rockCount; i++) {
      const pos = placeAwayFromWater(6);
      if (!pos) continue;
      const usedSmall = rng.frac() < 0.5 && scene.textures.exists(keys.smallRockKey);
      const key = usedSmall ? keys.smallRockKey : keys.rockKey;
      // Only the large rock blocks; small decorative rocks stay passable.
      addSprite(key, pos.x, pos.y, usedSmall ? 'none' : 'solid');
    }
  }

  private static tileRectToPx(rect: TileRect): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      rect.x * WORLD.TILE_SIZE,
      rect.y * WORLD.TILE_SIZE,
      rect.width * WORLD.TILE_SIZE,
      rect.height * WORLD.TILE_SIZE
    );
  }
}
