import { Auth } from './auth';
import { effect, untracked } from '@angular/core';
import { Store } from "./store";
import { Notifications } from "./core/data/notifications.service";
import { Component, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
@Component({
  selector: "app-root",
  styles: [`
    .account-button{border:1px solid var(--line);border-radius:8px;background:var(--tint);color:var(--accent);font-weight:650}
    .profile-menu{position:relative;flex-shrink:0;max-width:260px}
    .profile-menu summary{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none;padding:6px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
    .profile-menu summary::-webkit-details-marker{display:none}
    .avatar{width:34px;height:34px;display:grid;place-items:center;flex-shrink:0;border-radius:50%;background:var(--tint);color:var(--accent);font-weight:700}
    .profile-identity{display:flex;flex-direction:column;min-width:0;line-height:1.4}.profile-identity strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.profile-identity small{font-size:11px;color:var(--muted)}
    .profile-dropdown{position:absolute;right:0;top:calc(100% + 8px);min-width:190px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--surface);box-shadow:0 12px 28px #20344d1a;z-index:20}
    .profile-dropdown a,.profile-dropdown button{display:block;width:100%;text-align:left;padding:9px 12px;font:inherit;font-size:14px;text-decoration:none;color:var(--text);border:0;border-radius:6px;background:transparent}.profile-dropdown a:hover,.profile-dropdown button:hover{background:var(--tint);color:var(--accent)}
  `],
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip" href="#content">Skip to content</a>
    <header>
      <a class="brand" routerLink="/">Jedel<span>.</span>Group</a>
      <nav aria-label="Main navigation">
        @for (link of visibleLinks(); track link.path) {
          <a
            [routerLink]="link.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            ariaCurrentWhenActive="page"
            >{{ link.label }}</a
          >
        }
        @if(!auth.user()) {<a class="account-button" routerLink="/auth" routerLinkActive="active">Account</a>}
      </nav>
      @if(auth.user(); as user) {
        <details class="profile-menu account-summary">
          <summary aria-label="Open profile menu"><span class="avatar" aria-hidden="true">{{(user.name || user.username).charAt(0).toUpperCase()}}</span><span class="profile-identity"><strong>{{user.name || user.username}}</strong><small>{{user.role}}</small></span></summary>
          <div class="profile-dropdown"><a routerLink="/profile" (click)="closeProfile($event)">My Profile</a><a routerLink="/settings" (click)="closeProfile($event)">Settings</a>@if(user.can_manage_security) {<a routerLink="/settings" (click)="closeProfile($event)">Security access</a>}@if(user.can_administer) {<a href="http://127.0.0.1:8000/admin/">Administration</a>}<button type="button" [disabled]="loggingOut()" (click)="logout()">{{loggingOut() ? 'Logging out...' : 'Log out'}}</button></div>
        </details>
      }
    </header>
    @if(auth.user()?.capabilities?.read) {
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
      · <a routerLink="/settings">Settings</a> <button class="secondary" [disabled]="data.loading() || data.busy()" (click)="refresh()">Refresh</button>
    </div>
    }
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
    <footer>
      Jedel.Group · Supplier & purchasing management<span>Prices in KZT</span>
    </footer>
  `,
})
export class App {
  readonly auth = inject(Auth);
  async refresh() { try { await this.data.refresh(); } catch { /* The workspace displays the error. */ } }
  closeProfile(event: Event) { (event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open'); }
  visibleLinks() { return this.links; }
  readonly loggingOut = signal(false);
  async logout() {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try { await this.auth.logout(); this.data.disconnect(); }
    catch { this.notices.show('error', 'Log out failed. Please retry.'); }
    finally { this.loggingOut.set(false); }
  }
  constructor() {
    void this.auth.restore();
    effect(() => {
      if (this.auth.user()?.capabilities.read) untracked(() => { void this.data.refresh().catch(() => {}); });
      else untracked(() => this.data.disconnect(false));
    });
  }

  readonly data = inject(Store);
  readonly notices = inject(Notifications);
  links = [
    { path: "/", label: "Home" },
    { path: "/products", label: "Products" },
    { path: "/suppliers", label: "Suppliers" },
    { path: "/orders", label: "Orders" },
    { path: "/analytics", label: "Analytics" },
    { path: "/ai-assistant", label: "AI Assistant" },
  ];
}
