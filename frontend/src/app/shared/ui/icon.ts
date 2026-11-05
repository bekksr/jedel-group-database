import { Component, input } from '@angular/core';
import {
  LucideDynamicIcon,
  LucideLayoutDashboard as LayoutDashboard,
  LucideBuilding2 as Building2,
  LucidePackage as Package,
  LucideShoppingCart as ShoppingCart,
  LucideChartNoAxesCombined as ChartNoAxesCombined,
  LucideSettings2 as Settings2,
  LucideSearch as Search,
  LucidePlus as Plus,
  LucideChevronRight as ChevronRight,
  LucideArrowUpRight as ArrowUpRight,
  LucideArrowUpDown as ArrowUpDown,
  LucidePencil as Pencil,
  LucideTrash2 as Trash2,
  LucideX as X,
  LucideMenu as Menu,
  LucideDatabase as Database,
  LucideArrowRight as ArrowRight,
  LucideCircleHelp as CircleHelp,
  LucideRotateCcw as RotateCcw,
  LucideCheck as Check,
  LucideClock3 as Clock3,
  LucideTruck as Truck,
  LucideBan as Ban,
  LucideWallet as Wallet,
  LucideLayers as Layers,
  LucideSlidersHorizontal as SlidersHorizontal,
  LucideEye as Eye,
} from '@lucide/angular';
const ICONS = {
  dashboard: LayoutDashboard,
  suppliers: Building2,
  products: Package,
  orders: ShoppingCart,
  analytics: ChartNoAxesCombined,
  settings: Settings2,
  search: Search,
  plus: Plus,
  chevron: ChevronRight,
  arrowUp: ArrowUpRight,
  sort: ArrowUpDown,
  edit: Pencil,
  delete: Trash2,
  close: X,
  menu: Menu,
  database: Database,
  arrow: ArrowRight,
  help: CircleHelp,
  reset: RotateCcw,
  check: Check,
  clock: Clock3,
  truck: Truck,
  cancel: Ban,
  wallet: Wallet,
  layers: Layers,
  filter: SlidersHorizontal,
  eye: Eye,
};
export type IconName = keyof typeof ICONS;
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [LucideDynamicIcon],
  template: `<svg
    [lucideIcon]="icons[name()]"
    [size]="size()"
    [strokeWidth]="1.8"
    aria-hidden="true"
  />`,
  styles:
    ':host { display: inline-flex; flex-shrink: 0; align-items: center; vertical-align: middle; }',
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly icons = ICONS;
}
