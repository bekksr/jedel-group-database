import { DOCUMENT } from '@angular/common';
import { Auth } from './auth';
import { effect, untracked } from '@angular/core';
import { Store } from "./store";
import { Notifications } from "./core/data/notifications.service";
import { Component, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { UiLanguage } from './core/ui-language';
@Component({
  selector: "app-root",
  styles: [`
    .account-button{border:1px solid var(--line);border-radius:8px;background:var(--tint);color:var(--accent);font-weight:650}
    .profile-menu{position:relative;max-width:260px}
    .profile-menu summary{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none;padding:6px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
    .profile-menu summary::-webkit-details-marker{display:none}
    .avatar{width:34px;height:34px;display:grid;place-items:center;flex-shrink:0;border-radius:50%;background:var(--tint);color:var(--accent);font-weight:700}
    .profile-identity{display:flex;flex-direction:column;min-width:0;line-height:1.4}.profile-identity strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.profile-identity small{font-size:11px;color:var(--muted)}
    .profile-dropdown{position:absolute;inset-inline-end:0;top:calc(100% + 8px);width:max-content;max-width:min(260px,calc(100vw - 32px));padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--surface);box-shadow:0 12px 28px #20344d1a;z-index:20}
    .profile-dropdown a,.profile-dropdown button{display:block;width:100%;text-align:left;padding:9px 12px;font:inherit;font-size:14px;text-decoration:none;color:var(--text);border:0;border-radius:6px;background:transparent}.profile-dropdown a:hover,.profile-dropdown button:hover{background:var(--tint);color:var(--accent)}
    @media (max-width: 540px) { .profile-dropdown{inset-inline:0 auto} }
  `],
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip" href="#content">{{ text('Skip to content') }}</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" routerLink="/">
          <span class="brand-mark" aria-hidden="true">J</span>
          <span>Jedel<span class="brand-dot">.</span>Group</span>
        </a>
        <nav [attr.aria-label]="text('Main navigation')">
          @for (link of visibleLinks(); track link.path) {
            <a
              [routerLink]="link.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="navMatch"
              ariaCurrentWhenActive="page"
              >{{ text(link.label) }}</a
            >
          }
          @if (!auth.user()) {
            <a class="account-button" routerLink="/auth" routerLinkActive="active">{{ text('Account') }}</a>
          }
        </nav>
        <div class="header-actions">
          @if (auth.user(); as user) {
            <details class="profile-menu account-summary">
              <summary [attr.aria-label]="text('Open profile menu')">
                <span class="avatar" aria-hidden="true">{{ (user.name || user.username).charAt(0).toUpperCase() }}</span>
                <span class="profile-identity"><strong>{{ user.name || user.username }}</strong><small>{{ text(user.role) }}</small></span>
              </summary>
              <div class="profile-dropdown">
                <a routerLink="/profile" (click)="closeProfile($event)">{{ text('My Profile') }}</a>
                <a routerLink="/settings" (click)="closeProfile($event)">{{ text('Settings') }}</a>
                @if (user.can_manage_security) {
                  <a routerLink="/settings" (click)="closeProfile($event)">{{ text('Security access') }}</a>
                }
                @if (user.can_administer) {
                  <a href="http://127.0.0.1:8000/admin/">{{ text('Administration') }}</a>
                }
                <button type="button" [disabled]="loggingOut()" (click)="logout()">{{ text(loggingOut() ? 'Logging out...' : 'Log out') }}</button>
              </div>
            </details>
          }
          <select class="language-select" #languageSelect [value]="language.current()"
            [attr.aria-label]="text('Interface language')" (change)="changeLanguage(languageSelect)">
            <option value="en" lang="en">English</option>
            <option value="ru" lang="ru">Русский</option>
            <option value="kk" lang="kk">Қазақша</option>
          </select>
          <button class="secondary theme-toggle" type="button" [attr.aria-label]="text('Dark theme')"
            [attr.aria-pressed]="darkTheme()" (click)="toggleTheme()">
            <span aria-hidden="true">{{ darkTheme() ? '☀' : '☾' }}</span>
            <span class="theme-label">{{ text(darkTheme() ? 'Light mode' : 'Dark mode') }}</span>
          </button>
        </div>
      </div>
    </header>
    @if(auth.user()?.capabilities?.read) {
    <div class="workspace-bar"><div class="workspace-inner">
      <span>{{ text('Supplier Purchasing System') }}</span>
      <a routerLink="/settings" class="workspace-status" [class.ready]="!data.loading() && !data.error() && data.api.connected()">{{ text(data.loading() ? 'Loading workspace...' : data.error() ? 'API disconnected' : 'API connected') }}</a>
      <button type="button" class="secondary" [disabled]="data.loading() || data.busy()" (click)="refresh()">{{ text('Refresh') }}</button>
    </div></div>
    }
    <main id="content" tabindex="-1">
      <section [attr.aria-label]="text('Notifications')" aria-live="polite">
        @if (language.loadFailed()) {
          <p class="error">{{ text('Could not load the language. Select it again to retry.') }}</p>
        }
        @for (n of notices.messages(); track n.id) {
          <div class="note" [class.error]="n.kind === 'error'">
            <span>{{ text(n.message) }}</span>
            <button
              class="secondary"
              (click)="notices.dismiss(n.id)"
              [attr.aria-label]="text('Dismiss notification')"
            >
              ×
            </button>
          </div>
        }
      </section>
      <router-outlet />
    </main>
    <footer><span>Jedel.Group</span><span>{{ text('Prices in KZT') }}</span></footer>
  `,
})
export class App {
  private readonly document = inject(DOCUMENT);
  readonly language = inject(UiLanguage);
  readonly text = this.language.text;
  private readonly themeKey = "jedel.theme";
  readonly darkTheme = signal(false);
  readonly navMatch = {
    paths: "exact",
    queryParams: "ignored",
    matrixParams: "ignored",
    fragment: "ignored",
  } as const;
  readonly auth = inject(Auth);
  async refresh() { try { await this.data.refresh(); } catch { /* The workspace displays the error. */ } }
  closeProfile(event: Event) { (event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open'); }
  visibleLinks() {
    const canUsePrivateWorkspace = !!this.auth.user()?.capabilities?.read;
    return this.links.filter(link => canUsePrivateWorkspace || !['/analytics', '/ai-assistant'].includes(link.path));
  }
  readonly loggingOut = signal(false);
  async logout() {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try { await this.auth.logout(); this.data.disconnect(); }
    catch { this.notices.show('error', 'Log out failed. Please retry.'); }
    finally { this.loggingOut.set(false); }
  }
  constructor() {
    try {
      this.darkTheme.set(this.document.defaultView?.localStorage.getItem(this.themeKey) === "dark");
    } catch {
      // The browser may block storage.
    }
    this.applyTheme();
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
    { path: "/ai-assistant", label: "Jedel AI" },
  ];
  async changeLanguage(select: HTMLSelectElement): Promise<void> {
    const value = select.value;
    await this.language.select(value);
    if (this.language.loadFailed() && select.value === value) select.value = this.language.current();
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
