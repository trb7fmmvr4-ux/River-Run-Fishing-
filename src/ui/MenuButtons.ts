import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/GameConfig';
import { UIButton } from './UIButton';

const BUTTON_WIDTH = 64;
const BUTTON_HEIGHT = 24;
const MARGIN = 8;
const GAP = 6;

export interface MenuButtonsCallbacks {
  onToggleInventory: () => void;
  onToggleShop: () => void;
}

/**
 * The cluster of on-screen menu toggle buttons (Cooler, Shop), anchored
 * to the top-right corner so they're reachable on touch devices without
 * crowding the bottom-corner movement/action controls.
 *
 * These don't open panels themselves — they invoke the same callbacks the
 * scene wires to its keyboard toggles, so touch and keyboard go through
 * exactly one code path and behave identically (including the "can't open
 * mid-cast / only one at a time" rules).
 */
export class MenuButtons {
  private readonly coolerButton: UIButton;
  private readonly shopButton: UIButton;

  constructor(scene: Phaser.Scene, callbacks: MenuButtonsCallbacks) {
    const centerX = GAME_WIDTH - MARGIN - BUTTON_WIDTH / 2;
    const coolerY = MARGIN + BUTTON_HEIGHT / 2;
    const shopY = coolerY + BUTTON_HEIGHT + GAP;

    this.coolerButton = new UIButton(scene, {
      screenX: centerX,
      screenY: coolerY,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      label: 'Cooler',
      onPress: callbacks.onToggleInventory
    });

    this.shopButton = new UIButton(scene, {
      screenX: centerX,
      screenY: shopY,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      label: 'Shop',
      onPress: callbacks.onToggleShop
    });
  }

  /** Call once per frame so the buttons stay anchored as the camera scrolls. */
  public update(): void {
    this.coolerButton.update();
    this.shopButton.update();
  }

  public destroy(): void {
    this.coolerButton.destroy();
    this.shopButton.destroy();
  }
}
