import { Store } from "./store";
import { Notifications } from "./core/data/notifications.service";
import { Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
@Component({
  selector: "app-root",
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip" href="#content">Skip to content</a>
    <header>
      <a class="brand" routerLink="/">Jedel<span>.</span>Group</a>
      <nav aria-label="Main navigation">
        @for (link of links; track link.path) {
          <a
            [routerLink]="link.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            ariaCurrentWhenActive="page"
            >{{ link.label }}</a
          >
        }
      </nav>
    </header>
    <div class="demo">
      {{
        data.mode === "demo"
          ? "Demo · Changes reset on refresh. No database writes."
          : data.loading()
            ? "API · Loading…"
            : data.error()
              ? "API · Not connected"
              : "API · Connected"
      }}
      · <a routerLink="/settings">Connection</a>
    </div>
    <main id="content" tabindex="-1">
      @if (data.error()) {
        <p class="error" role="alert">
          {{ data.error() }} <a routerLink="/settings">Open Connection</a>
        </p>
      }
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
    <footer>
      Jedel.Group · Supplier & purchasing management<span>Prices in KZT</span>
    </footer>
  `,
})
export class App {
  readonly data = inject(Store);
  readonly notices = inject(Notifications);
  links = [
    { path: "/", label: "Home" },
    { path: "/products", label: "Products" },
    { path: "/suppliers", label: "Suppliers" },
    { path: "/orders", label: "Orders" },
    { path: "/register", label: "Register" },
    { path: "/settings", label: "Connection" },
  ];
}
