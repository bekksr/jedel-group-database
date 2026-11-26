import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../auth';
import { ApiDataService } from '../core/data/api-data.service';
import { apiError } from '../core/data/api-errors';
import { UiLanguage } from '../core/ui-language';
@Component({
  imports: [FormsModule],
  styles: [`
    :host { display: block; }
    .profile-page {
      display: grid;
      gap: var(--section-gap);
      max-width: 1080px;
      margin-inline: auto;
    }
    .profile-card {
      display: grid;
      gap: 20px;
      align-items: center;
      padding: clamp(18px, 3vw, 32px);
      background: linear-gradient(135deg, var(--tint), var(--surface) 65%);
    }
    .profile-overview { display: flex; align-items: center; min-width: 0; gap: 16px; }
    .profile-avatar {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: clamp(56px, 8vw, 80px);
      aspect-ratio: 1;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--surface);
      color: var(--accent);
      font-size: clamp(1.5rem, 3vw, 2.15rem);
      font-weight: 750;
    }
    .profile-identity { min-width: 0; }
    .profile-identity h1 { margin: 0 0 4px; }
    .profile-identity p { margin: 0; color: var(--muted); }
    .profile-fields {
      display: grid;
      gap: 12px;
      margin: 0;
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }
    .profile-fields dd { margin-top: 2px; font-weight: 600; }
    .profile-layout { display: grid; gap: var(--card-gap); align-items: start; }
    .profile-layout h2, .accounts-panel h2 { margin-bottom: 16px; }
    .profile-form > button { margin-top: 12px; }
    .profile-form + .profile-form { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line); }
    .profile-form input { margin: 6px 0 0; }
    .password-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px; }
    .profile-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 14px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }
    .profile-actions p { margin: 0; }
    .profile-access dl { margin: 0; }
    .account-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px 12px;
    }
    .permission-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding-block: 9px;
    }
    .permission-row + .permission-row, .account-row { border-top: 1px solid var(--line); }
    .permission-row dt { color: var(--text); font-size: inherit; overflow-wrap: anywhere; }
    .permission-row dd { border-radius: 6px; padding: 2px 8px; font-size: .8rem; font-weight: 650; }
    .ok { color: var(--accent); background: var(--tint); }
    .no { color: var(--muted); background: var(--surface-subtle); }
    .dbbox { margin-top: 16px; padding: 12px; border-radius: 8px; background: var(--surface-subtle); }
    .dbbox .hint { display: block; margin-bottom: 3px; }
    .account-list { margin: 0; padding: 0; list-style: none; }
    .account-row { padding-block: 10px; }
    .account-row:last-child { padding-bottom: 0; }
    @media (min-width: 480px) {
      .profile-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (min-width: 800px) {
      .profile-card { grid-template-columns: minmax(0, 1fr) minmax(0, .95fr); }
      .profile-fields { border-top: 0; border-inline-start: 1px solid var(--line); padding: 4px 0 4px 20px; }
      .profile-layout { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
    }
  `],
  template: `
    @if (auth.user(); as user) {
      @let displayName = user.name || user.username;
      <div class="profile-page">
        <section class="panel profile-card" aria-labelledby="profile-name">
          <div class="profile-overview">
            <span class="profile-avatar" aria-hidden="true">{{ displayName.charAt(0).toUpperCase() }}</span>
            <div class="profile-identity">
              <h1 id="profile-name">{{ displayName }}</h1>
              <p>{{ text(user.role) }}</p>
            </div>
          </div>
          <dl class="profile-fields">
            <div><dt>{{ text('Username') }}</dt><dd>{{ user.username }}</dd></div>
            <div><dt>{{ text('Email') }}</dt><dd>{{ user.email }}</dd></div>
          </dl>
        </section>

        <div class="profile-layout">
          <section class="panel" aria-labelledby="account-settings-title">
            <h2 id="account-settings-title">{{ text('Account settings') }}</h2>
            <form class="profile-form" (ngSubmit)="save()">
              <label>{{ text('Name') }}<input name="name" [(ngModel)]="name" autocomplete="name"></label>
              <button type="submit" [disabled]="busy()">{{ text('Save name') }}</button>
            </form>
            <form class="profile-form" [attr.aria-label]="text('Change password')" (ngSubmit)="changePassword()">
              <div class="password-fields">
                <label>{{ text('Current password') }}<input name="currentPassword" type="password" [(ngModel)]="current" autocomplete="current-password"></label>
                <label>{{ text('New password') }}<input name="newPassword" type="password" [(ngModel)]="password" autocomplete="new-password"></label>
                <label>{{ text('Confirm new password') }}<input name="confirmPassword" type="password" [(ngModel)]="passwordConfirm" autocomplete="new-password"></label>
              </div>
              <button type="submit" class="secondary" [disabled]="busy()">{{ text('Change password') }}</button>
            </form>
            <div class="profile-actions">
              <button type="button" class="secondary" [disabled]="busy()" (click)="logout()">{{ text('Sign out') }}</button>
              <p role="status">{{ text(message()) }}</p>
            </div>
          </section>

          <section class="panel profile-access" aria-labelledby="profile-access-title">
            <h2 id="profile-access-title">{{ text('What your role can do') }}</h2>
            @if (hasAccess()) {
              <dl>
                @for (row of rows; track row.key) {
                  @let allowed = can(row.key);
                  <div class="permission-row">
                    <dt>{{ text(row.label) }}</dt>
                    <dd [class.ok]="allowed" [class.no]="!allowed">{{ text(allowed ? 'Allowed' : 'Not allowed') }}</dd>
                  </div>
                }
              </dl>
            } @else {
              <p>{{ text('Your role has no purchasing permissions. You can browse the public catalog.') }}</p>
            }
            @if (dbStatus(); as databaseStatus) {
              <div class="dbbox">
                <span class="hint">{{ text('Visible to System Administrator only') }}</span>
                {{ text('Database connection') }}: {{ text(databaseStatus) }}
              </div>
            }
          </section>
        </div>

        @if (accounts().length) {
          <section class="panel accounts-panel" aria-labelledby="account-access-title">
            <h2 id="account-access-title">{{ text('Account access') }}</h2>
            <p>{{ text('Activate or suspend assigned employees and analysts. Role assignments require an authorized System Administrator.') }}</p>
            <ul class="account-list">
              @for (account of accounts(); track account.id) {
                <li class="account-row">
                  <span>{{ account.username }} · {{ text(account.is_active ? 'Active' : 'Suspended') }}</span>
                  <button type="button" class="secondary" [disabled]="busy()" (click)="activate(account)">{{ text(account.is_active ? 'Suspend' : 'Activate') }}</button>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    }
  `,
})
export class ConnectionPage implements OnInit {
  readonly text = inject(UiLanguage).text;
  readonly rows = [
    {key: 'read', label: 'View catalog and orders'},
    {key: 'manage_catalog', label: 'Manage suppliers and products'},
    {key: 'create_orders', label: 'Create purchase orders'},
    {key: 'transition_orders', label: 'Approve, deliver, cancel'},
    {key: 'delete_records', label: 'Delete records'},
  ];
  accounts = signal<{id: number; username: string; is_active: boolean}[]>([]);
  private info() {
    return this.auth.user() as unknown as {capabilities?: Record<string, boolean>; database_restricted?: boolean | null} | null;
  }
  can(key: string) { return !!this.info()?.capabilities?.[key]; }
  hasAccess() { return this.rows.some(row => this.can(row.key)); }
  dbStatus() {
    const value = this.info()?.database_restricted;
    if (value === undefined) return '';
    return value === true ? 'Restricted (no superuser)' : value === false ? 'Privileged (superuser)' : 'Unknown';
  }
  async ngOnInit() {
    if (this.auth.user()?.can_manage_security) {
      try { this.accounts.set((await firstValueFrom(this.http.get<{results: {id: number; username: string; is_active: boolean}[]}>(this.auth.base.replace(/auth\/$/, 'security/accounts/')))).results); } catch (error) { this.message.set(apiError(error)); }
    }
  }
  activate(account: {id: number; username: string; is_active: boolean}) { return this.run(async () => {
    await firstValueFrom(this.http.patch(this.auth.base.replace(/auth\/$/, 'security/accounts/') + account.id + '/', {is_active: !account.is_active}));
    await this.ngOnInit(); this.message.set('Account access updated.');
  }); }

  auth = inject(Auth); data = inject(ApiDataService); router = inject(Router); http = inject(HttpClient);
  name = this.auth.user()?.name ?? ''; current = ''; password = ''; passwordConfirm = ''; busy = signal(false); message = signal('');
  async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true); this.message.set('');
    try { await action(); } catch (e) { this.message.set(apiError(e)); } finally { this.busy.set(false); }
  }
  save() { return this.run(async () => { const user = await firstValueFrom(this.http.patch<import('../auth').Account>(this.auth.base + 'profile/', {name: this.name})); this.auth.user.set(user); this.message.set('Profile saved.'); }); }
  changePassword() { return this.run(async () => { await firstValueFrom(this.http.post(this.auth.base + 'password/', {current_password: this.current, new_password: this.password, new_password_confirm: this.passwordConfirm})); this.current = ''; this.password = ''; this.passwordConfirm = ''; this.message.set('Password changed.'); }); }
  logout() { return this.run(async () => { await this.auth.logout(); this.data.disconnect(); await this.router.navigateByUrl('/login'); }); }
}
