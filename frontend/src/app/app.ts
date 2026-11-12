import { Store } from "./store";
import { Notifications } from "./core/data/notifications.service";
import { DOCUMENT } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
@Component({
  selector: "app-root",
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip" href="#content">Skip to content</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" routerLink="/">
          <span class="brand-mark" aria-hidden="true">J</span>
          <span>Jedel<span class="brand-dot">.</span>Group</span>
        </a>
        <nav aria-label="Main navigation">
          @for (link of links; track link.path) {
            <a
              [routerLink]="link.path"
              routerLinkActive="active"
            [routerLinkActiveOptions]="navMatch"
              ariaCurrentWhenActive="page"
              >{{ link.label }}</a
            >
          }
        </nav>
        <button
          class="secondary theme-toggle"
          type="button"
          aria-label="Dark theme"
          [attr.aria-pressed]="darkTheme()"
          (click)="toggleTheme()"
        >
          <span aria-hidden="true">{{ darkTheme() ? "☀" : "☾" }}</span>
          <span>{{ darkTheme() ? "Light mode" : "Dark mode" }}</span>
        </button>
      </div>
    </header>
    <div class="workspace-bar">
      <div class="workspace-inner">
        <span>Supplier Purchasing System</span>
        <a routerLink="/settings" class="workspace-status" [class.ready]="data.mode === 'demo' || data.api.connected()">
          {{
            data.loading()
              ? "Loading workspace…"
              : data.mode === "demo"
                ? "Demo workspace"
                : data.api.connected()
                  ? "API connected"
                  : "API disconnected"
          }}
        </a>
      </div>
    </div>
    <main id="content" tabindex="-1">
      <section aria-label="Notifications" aria-live="polite">
        @for (n of notices.messages(); track n.id) {
          <div class="note" [class.error]="n.kind === 'error'">
            <span>{{ n.message }}</span>
            <button
              class="secondary"
              (click)="notices.dismiss(n.id)"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        }
      </section>
      <router-outlet />
    </main>
    <footer><span>Jedel.Group</span><span>Prices in KZT</span></footer>
  `,
})
export class App {
  readonly data = inject(Store);
  readonly notices = inject(Notifications);
  private readonly document = inject(DOCUMENT);
  private readonly themeKey = "jedel.theme";
  readonly darkTheme = signal(false);
  readonly navMatch = {
    paths: "exact",
    queryParams: "ignored",
    matrixParams: "ignored",
    fragment: "ignored",
  } as const;
  readonly links = [
    { path: "/", label: "Home" },
    { path: "/products", label: "Products" },
    { path: "/suppliers", label: "Suppliers" },
    { path: "/orders", label: "Orders" },
    { path: "/register", label: "Register" },
    { path: "/settings", label: "Connection" },
  ];

  constructor() {
    try {
      this.darkTheme.set(this.document.defaultView?.localStorage.getItem(this.themeKey) === "dark");
    } catch {
      // The browser may block storage.
    }
    this.applyTheme();
  }

  toggleTheme(): void {
    this.darkTheme.update((dark) => !dark);
    this.applyTheme();
    try {
      this.document.defaultView?.localStorage.setItem(this.themeKey, this.darkTheme() ? "dark" : "light");
    } catch {
      // The theme still applies for the current session.
    }
  }

  private applyTheme(): void {
    this.document.documentElement.dataset["theme"] = this.darkTheme() ? "dark" : "light";
  }
}
