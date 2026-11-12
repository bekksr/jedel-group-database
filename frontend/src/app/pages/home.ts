import { Component, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../store";

@Component({
  imports: [RouterLink],
  template: `
    <section class="hero" aria-labelledby="home-title">
      <div class="hero-copy">
        <h1 id="home-title">Purchasing workspace</h1>
        <p>Find products, choose a supplier, and track purchase orders from placement to delivery.</p>
        <div class="actions">
          @if (data.mode === "demo" || data.api.connected()) {
            @if (data.permissions().createOrders && data.canWrite()) {
              <a class="button" routerLink="/orders" [queryParams]="{ new: 1 }">New purchase order</a>
            }
            <a class="button secondary" routerLink="/products">Browse products</a>
          } @else {
            @if (data.demoAvailable) {
              <button type="button" [disabled]="data.loading() || data.busy()" (click)="openDemo()">
                {{ data.loading() ? "Opening workspace…" : "Open demo" }}
              </button>
            }
            <a class="button secondary" routerLink="/settings">Connect to API</a>
          }
        </div>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </div>
      <aside class="hero-overview" aria-labelledby="overview-title">
        <h2 id="overview-title">Workspace overview</h2>
        @if (data.mode === "demo" || data.api.connected()) {
          <dl class="overview-list">
            <div><dt>Products</dt><dd>{{ data.products().length }}</dd></div>
            <div><dt>Suppliers</dt><dd>{{ data.suppliers().length }}</dd></div>
            <div><dt>Purchase orders</dt><dd>{{ data.orders().length }}</dd></div>
          </dl>
          @if (data.mode === "demo") {
            <p class="overview-hint">Demo changes reset on refresh.</p>
          }
        } @else {
          <p>Open the demo to explore the catalog and place a sample order. Connect to the team API to use live purchasing records.</p>
        }
      </aside>
    </section>

    <section class="home-shortcuts" aria-labelledby="shortcuts-title">
      <h2 id="shortcuts-title">Explore the workspace</h2>
      <div class="cards">
        <article class="panel shortcut">
          <h3><a routerLink="/products">Product catalog <span aria-hidden="true">↗</span></a></h3>
          <p>Search by name or category and check prices, stock, and purchasing history.</p>
        </article>
        <article class="panel shortcut">
          <h3><a routerLink="/suppliers">Suppliers <span aria-hidden="true">↗</span></a></h3>
          <p>Find a supplier, review contact details, and start an order.</p>
        </article>
        <article class="panel shortcut">
          <h3><a routerLink="/orders">Purchase orders <span aria-hidden="true">↗</span></a></h3>
          <p>Review order items, estimated delivery dates, and current status.</p>
        </article>
      </div>
    </section>
  `,
})
export class HomePage {
  readonly data = inject(Store);
  readonly error = signal("");

  async openDemo(): Promise<void> {
    this.error.set("");
    try {
      await this.data.useDemo();
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }
}
