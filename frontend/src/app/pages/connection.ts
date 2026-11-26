import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../auth';
import { ApiDataService } from '../core/data/api-data.service';
import { apiError } from '../core/data/api-errors';
import { UiLanguage } from '../core/ui-language';
@Component({imports: [FormsModule],styles:[`:host{display:block}.panel{display:grid;gap:16px}.panel p{margin:0}.panel button{justify-self:start}.panel label{margin:0}.panel input{width:100%}.panel+.panel{margin-top:24px}.panel p button{margin-inline-start:12px}.layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px;align-items:start}.layout .panel{margin-top:0}.security{border-color:#4f86d6}.security h2{margin:0;color:#8db8f5}.security .sub{color:#9fb0c8}.row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid rgba(255,255,255,.1);padding-top:10px}.ok{color:#6fd39a;font-weight:600}.no{color:#f08a8a;font-weight:600}.dbbox{border:1px dashed #4f86d6;border-radius:8px;padding:10px 12px;background:rgba(79,134,214,.12)}.dbbox .hint{font-size:12px;color:#9fb0c8;display:block;margin-bottom:4px}`], template: `<h1>{{ text('Account settings') }}</h1>@if (auth.user(); as user) {<div class="layout"><section class="panel narrow"><p>{{user.name}} ({{user.username}})</p><p>{{user.email}}</p><p>{{ text('Role: {role}', {role: text(user.role)}) }}</p><label>{{ text('Name') }}<input [(ngModel)]="name" autocomplete="name"></label><button [disabled]="busy()" (click)="save()">{{ text('Save name') }}</button><label>{{ text('Current password') }}<input type="password" [(ngModel)]="current" autocomplete="current-password"></label><label>{{ text('New password') }}<input type="password" [(ngModel)]="password" autocomplete="new-password"></label><label>{{ text('Confirm new password') }}<input type="password" [(ngModel)]="passwordConfirm" autocomplete="new-password"></label><button [disabled]="busy()" (click)="changePassword()">{{ text('Change password') }}</button><button [disabled]="busy()" (click)="logout()">{{ text('Sign out') }}</button><p role="status">{{ text(message()) }}</p></section>
<section class="panel security"><h2>{{ text('Access and security') }}</h2><p class="sub">{{ text('What your role can do') }}</p>@if(hasAccess()) {@for(row of rows; track row.key) {<div class="row"><span>{{ text(row.label) }}</span><span [class.ok]="can(row.key)" [class.no]="!can(row.key)">{{ can(row.key) ? '✓ ' : '✕ ' }}{{ text(can(row.key) ? 'Allowed' : 'Not allowed') }}</span></div>}} @else {<p>{{ text('Your role has no purchasing permissions. You can browse the public catalog.') }}</p>}@if(dbStatus()) {<div class="dbbox"><span class="hint">{{ text('Visible to System Administrator only') }}</span>{{ text('Database connection') }}: <span [class.ok]="dbStatus() === 'Restricted (no superuser)'" [class.no]="dbStatus() !== 'Restricted (no superuser)'">{{ text(dbStatus()) }}</span></div>}</section></div>
@if(accounts().length) {<section class="panel" style="margin-top:24px"><h2>{{ text('Account access') }}</h2><p>{{ text('Activate or suspend assigned employees and analysts. Role assignments require an authorized System Administrator.') }}</p>@for(account of accounts(); track account.id) {<p>{{account.username}}: {{ text(account.is_active ? 'Active' : 'Suspended') }} <button [disabled]="busy()" (click)="activate(account)">{{ text(account.is_active ? 'Suspend' : 'Activate') }}</button></p>}</section>}}`})
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