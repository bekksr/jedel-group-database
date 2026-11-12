import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../auth';
import { ApiDataService } from '../core/data/api-data.service';
import { apiError } from '../core/data/api-errors';
@Component({imports: [FormsModule],styles:[`:host{display:block}.panel{display:grid;gap:16px}.panel p{margin:0}.panel button{justify-self:start}.panel label{margin:0}.panel input{width:100%}.panel+.panel{margin-top:24px}.panel p button{margin-inline-start:12px}`], template: `<h1>Account settings</h1>@if (auth.user(); as user) {<section class="panel narrow"><p>{{user.name}} ({{user.username}})</p><p>{{user.email}}</p><p>Role: {{user.role}}</p><label>Name<input [(ngModel)]="name" autocomplete="name"></label><button [disabled]="busy()" (click)="save()">Save name</button><label>Current password<input type="password" [(ngModel)]="current" autocomplete="current-password"></label><label>New password<input type="password" [(ngModel)]="password" autocomplete="new-password"></label><button [disabled]="busy()" (click)="changePassword()">Change password</button><button [disabled]="busy()" (click)="logout()">Sign out</button><p role="status">{{message()}}</p></section>
@if(accounts().length) {<section class="panel"><h2>Account access</h2><p>Activate or suspend assigned employees and analysts. Role assignments require an authorized System Administrator.</p>@for(account of accounts(); track account.id) {<p>{{account.username}}: {{account.is_active ? 'Active' : 'Suspended'}} <button [disabled]="busy()" (click)="activate(account)">{{account.is_active ? 'Suspend' : 'Activate'}}</button></p>}</section>}}`})
export class ConnectionPage implements OnInit {
  accounts = signal<{id: number; username: string; is_active: boolean}[]>([]);
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
  name = this.auth.user()?.name ?? ''; current = ''; password = ''; busy = signal(false); message = signal('');
  async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true); this.message.set('');
    try { await action(); } catch (e) { this.message.set(apiError(e)); } finally { this.busy.set(false); }
  }
  save() { return this.run(async () => { const user = await firstValueFrom(this.http.patch<import('../auth').Account>(this.auth.base + 'profile/', {name: this.name})); this.auth.user.set(user); this.message.set('Profile saved.'); }); }
  changePassword() { return this.run(async () => { await firstValueFrom(this.http.post(this.auth.base + 'password/', {current_password: this.current, new_password: this.password})); this.current = ''; this.password = ''; this.message.set('Password changed.'); }); }
  logout() { return this.run(async () => { await this.auth.logout(); this.data.disconnect(); await this.router.navigateByUrl('/login'); }); }
}
