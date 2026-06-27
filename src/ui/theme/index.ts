/**
 * River Run Fishing — UI Framework (theme kit).
 *
 * Single import point for the reusable, consistently-styled UI building
 * blocks. Future systems (Inventory, Cooler, Shop, Journal, Crafting,
 * Quests, Housing, Boss UI) should build from these rather than hand-
 * rolling panels/buttons, so the whole game stays visually consistent.
 *
 *   import { ThemePanel, TextButton, Tooltip, Notifications, MenuNav }
 *     from '../ui/theme';
 *
 * All components draw their colours, spacing, and type from UI_THEME in
 * GameConfig — the single source of truth for the style guide. Existing
 * in HUDScene, not the menu scenes this kit was built for (Inventory/Shop
 * predate the HUDScene split and have their own established style);
 * this kit is for new and future UI.
 */
export { ThemePanel } from './ThemePanel';
export type { ThemePanelOptions } from './ThemePanel';

export { TextButton } from './TextButton';
export type { TextButtonOptions } from './TextButton';

export { Tooltip } from './Tooltip';
export type { TooltipOptions } from './Tooltip';

export { Notifications } from './Notifications';
export type { ToastVariant } from './Notifications';

export { MenuNav } from './MenuNav';
