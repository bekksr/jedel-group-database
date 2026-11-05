import { ERP_DATA } from '../data/models';
import { Notifications } from '../data/notifications.service';
import {
  Component,
  computed,
  inject,
  signal,
  HostListener,
  ElementRef,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { Icon, IconName } from '../../shared/ui/icon';
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  readonly data = inject(ERP_DATA);
  readonly notices = inject(Notifications);
  async refresh(): Promise<void> {
    try {
      await this.data.refresh?.();
    } catch (e) {
      this.notices.show('error', (e as Error).message);
    }
  }
  private readonly router = inject(Router);
  readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  @HostListener('document:keydown.escape') closeMenu(): void {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
      this.menuButton()?.nativeElement.focus();
    }
  }
  readonly menuOpen = signal(false);
  readonly navigation: readonly { path: string; label: string; icon: IconName }[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/suppliers', label: 'Suppliers', icon: 'suppliers' },
    { path: '/products', label: 'Products', icon: 'products' },
    { path: '/purchase-orders', label: 'Purchase Orders', icon: 'orders' },
    { path: '/analytics', label: 'Analytics', icon: 'analytics' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];
  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url.split('?')[0]),
      startWith(this.router.url.split('?')[0]),
    ),
    { initialValue: '/dashboard' },
  );
  readonly title = computed(
    () => this.navigation.find((n) => n.path === this.currentUrl())?.label ?? 'Dashboard',
  );
}
