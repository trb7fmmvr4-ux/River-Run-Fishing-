import Phaser from 'phaser';
import { INPUT } from '../config/GameConfig';
import type { MovementIntent } from '../types/GameTypes';
import { VirtualJoystick } from './VirtualJoystick';
import { ActionButton } from './ActionButton';

type WasdKeys = Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

/**
 * Single entry point for "what does the player want to do this frame".
 *
 * Combines keyboard and (on touch-capable devices) the on-screen virtual
 * joystick into one normalized MovementIntent, so entities never need to
 * know which input source produced it.
 *
 * Critically, this exposes two SEPARATE signals where the project used to
 * have one merged "action" press — that merge was the root cause of a
 * real bug (fishing's "Need to be in the water..." message appearing
 * when the player meant to attack): `isUseToolJustPressed()` (Left Mouse,
 * or the on-screen action button) for "use whatever's equipped", and
 * `isInteractJustPressed()` (E) for "talk/interact with the world". They
 * are never combined here — each system decides what to do with its own
 * signal, and nothing has to guess which the player meant.
 *
 * Space is deliberately NOT bound to anything yet — reserved for a future
 * dodge-roll. Shift exposes a sprint flag for movement speed; this class
 * doesn't decide what "sprint" does, it just reports whether the key is
 * held, same as it always reported raw WASD state.
 */
export class InputManager {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd: WasdKeys;
  private readonly sprintKey: Phaser.Input.Keyboard.Key;
  private readonly interactKey: Phaser.Input.Keyboard.Key;
  private readonly inventoryKey: Phaser.Input.Keyboard.Key;
  private readonly shopKey: Phaser.Input.Keyboard.Key;
  private readonly joystick: VirtualJoystick | null;
  private readonly actionButton: ActionButton | null;
  private leftMousePressed = false;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('InputManager requires keyboard input to be enabled on the scene.');
    }

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys('W,A,S,D') as WasdKeys;
    this.sprintKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.inventoryKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.shopKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);

    // Left Mouse = "use equipped item". Tracked via Phaser's pointer
    // events rather than a Key object (mouse buttons aren't keyboard
    // keys); consumed exactly like the action button below so both
    // sources share one "was it pressed since the last check" contract.
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.leftMousePressed = true;
    });

    // The virtual joystick is gated behind a config flag for the desktop
    // testing pass. The class and all its wiring stay intact; flip
    // INPUT.ENABLE_VIRTUAL_JOYSTICK back on to restore mobile movement
    // with no other changes.
    //
    // Touch capability is checked two ways and BOTH must agree: Phaser's
    // own device flag, AND the `(pointer: coarse)` media query. Phaser's
    // flag alone can false-positive on laptop trackpads that support
    // multi-touch gestures (they're not a touchscreen), which would show
    // the joystick on a plain PC. `pointer: coarse` specifically means "the
    // primary input is imprecise, like a finger" and doesn't fire for
    // trackpads/mice, so combining the two is a reliable touchscreen check.
    const supportsTouch = scene.sys.game.device.input.touch;
    const hasCoarsePointer =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    this.joystick =
      INPUT.ENABLE_VIRTUAL_JOYSTICK && supportsTouch && hasCoarsePointer
        ? new VirtualJoystick(scene)
        : null;

    // Always created, not just on touch devices, when enabled: feeds the
    // same "use equipped item" signal as Left Mouse, so it doubles as a
    // guaranteed fallback if a mouse/keyboard isn't registering for any
    // reason. PC-first: off by default (see GameConfig.INPUT), but the
    // class and wiring stay fully intact for a future mobile pass — only
    // construction is gated, nothing about how it works changed.
    this.actionButton = INPUT.ENABLE_ACTION_BUTTON ? new ActionButton(scene) : null;
  }

  public getMovementIntent(): MovementIntent {
    const keyboardIntent = this.getKeyboardIntent();
    if (keyboardIntent.x !== 0 || keyboardIntent.y !== 0) {
      return keyboardIntent;
    }

    return this.joystick?.getIntent() ?? { x: 0, y: 0 };
  }

  /** True while Shift is held — movement speed/feel decisions belong to the caller, not here. */
  public isSprintDown(): boolean {
    return this.sprintKey.isDown;
  }

  /** Forward per-frame updates to the on-screen controls so they stay camera-anchored. */
  public update(): void {
    this.joystick?.update();
    this.actionButton?.update();
  }

  /** True exactly once per press — Left Mouse or the on-screen action button. "Use whatever's equipped." */
  public isUseToolJustPressed(): boolean {
    const mousePressed = this.leftMousePressed;
    this.leftMousePressed = false;
    const buttonPressed = this.actionButton?.consumePress() ?? false;
    return mousePressed || buttonPressed;
  }

  /** True exactly once per press of E. "Talk/interact with the world" — never triggers tool use. */
  public isInteractJustPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.interactKey);
  }

  /** True exactly once per press of the Cooler/Inventory toggle key (I). */
  public isInventoryToggleJustPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.inventoryKey);
  }

  /** True exactly once per press of the Shop toggle key (B). */
  public isShopToggleJustPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.shopKey);
  }

  private getKeyboardIntent(): MovementIntent {
    let x = 0;
    let y = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) y += 1;

    return { x, y };
  }

  public destroy(): void {
    this.joystick?.destroy();
    this.actionButton?.destroy();
  }
}
