import { WorkspaceStatus } from './workspace-status';
import { Supplier } from '../models';
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Store } from "../store";
import { UiLanguage } from '../core/ui-language';

@Component({selector:"ng-component-suppliers",
  imports: [WorkspaceStatus, FormsModule, RouterLink],
  template: `
    <h1>{{ text('Suppliers') }}</h1>
    <p class="subtitle">{{ text('Search the directory and choose a supplier for your order.') }}</p>
    <app-workspace-status />
    @if (data.permissions().manageCatalog) {
      <button class="catalog-create" [disabled]="busy() || data.loading()" (click)="edit()">{{ text('New supplier') }}</button>
      @if (formOpen()) {
        <form class="panel narrow catalog-form" (ngSubmit)="save()">
          <h2>{{ text(editingId === undefined ? 'New supplier' : 'Edit supplier') }}</h2>
          <label>{{ text('Supplier name') }}<input name="supplier_name" [(ngModel)]="draft.supplier_name" required maxlength="100"></label>
          <label>{{ text('Email') }}<input name="email" type="email" [(ngModel)]="draft.email" required maxlength="100"></label>
          <label>{{ text('Phone') }}<input name="phone" [(ngModel)]="draft.phone" maxlength="20"></label>
          <label>{{ text('Address') }}<input name="address" [(ngModel)]="draft.address" maxlength="255"></label>
          <div class="actions">
            <button [disabled]="busy() || data.loading()">{{ text('Save supplier') }}</button>
            <button type="button" class="secondary" [disabled]="busy()" (click)="formOpen.set(false)">{{ text('Cancel') }}</button>
          </div>
        </form>
      }
    }
    @if(error()) { <p class="error" role="alert">{{ text(error()) }}</p> }

    @if (data.loading()) {
      <p class="panel" role="status">{{ text('Loading suppliers…') }}</p>
    } @else if (data.error()) {
      <p class="panel">{{ text('Restore the business connection using Retry workspace above.') }}</p>
    } @else {
      <div class="catalog-toolbar">
        <div class="search-field">
          <label for="suppliers-search">{{ text('Search suppliers') }}</label>
          <div class="search-control">
            <input id="suppliers-search" #supplierSearch type="search" [ngModel]="query()"
              (ngModelChange)="query.set($event)" [placeholder]="text('Name, address, email, or phone')" />
            @if (query()) {
              <button type="button" class="secondary clear-search" [title]="text('Clear search')"
                [attr.aria-label]="text('Clear search')" (click)="query.set(''); supplierSearch.focus()">×</button>
            }
          </div>
        </div>
        <label>{{ text('Address filter') }}
          <select [ngModel]="address()" (ngModelChange)="address.set($event)">
            <option value="">{{ text('All addresses') }}</option>
            @for (value of addresses(); track value) {<option [value]="value">{{value}}</option>}
          </select>
        </label>
        <p class="result-count" role="status">{{ text('{count} of {total} suppliers', {count: filtered().length, total: data.suppliers().length}) }}</p>
      </div>

      <div class="cards catalog-cards">
        @for (supplier of filtered(); track supplier.supplier_id) {
          <article class="panel catalog-card">
            <h2>{{ supplier.supplier_name }}</h2><div class="actions">@if(data.permissions().manageCatalog) {<button type="button" class="secondary" [disabled]="busy() || data.loading()" (click)="edit(supplier)">{{ text('Edit') }}</button>}@if(data.permissions().deleteRecords) {<button type="button" class="secondary" [disabled]="busy() || data.loading()" (click)="remove(supplier)">{{ text('Delete') }}</button>}</div>
            <dl class="contact-details">
              <div><dt>{{ text('Address') }}</dt><dd>{{ supplier.address || text('Not listed') }}</dd></div>
              <div><dt>{{ text('Email') }}</dt><dd>{{ supplier.email }}</dd></div>
              <div><dt>{{ text('Phone') }}</dt><dd>{{ supplier.phone || text('Not listed') }}</dd></div>
            </dl>
            @if (canOrder()) {
              <a class="button secondary card-action" routerLink="/orders" [queryParams]="{ new: 1, supplier: supplier.supplier_id }">
                {{ text('Choose supplier') }}
              </a>
            }
          </article>
        } @empty {
          <div class="panel empty-state">
            @if (query().trim() || address()) {
              <p>{{ text('No suppliers match your search.') }}</p>
              @if (address()) {
                <button type="button" class="secondary" (click)="query.set(''); address.set('')">{{ text('Clear filters') }}</button>
              }
            } @else {
              <p>{{ text('No suppliers are available in this workspace.') }}</p>
            }
          </div>
        }
      </div>
    }
  `,
})
export class SuppliersPage {
  readonly text = inject(UiLanguage).text;
  private readonly route = inject(ActivatedRoute);
  constructor() {
    let opened = false;
    effect(() => {
      if (!opened && this.route.snapshot.data?.['create'] && this.data.permissions().manageCatalog && !this.data.loading()) {
        opened = true; untracked(() => this.edit());
      }
    });
  }
  readonly address = signal('');
  readonly addresses = computed(()=>[...new Set(this.data.suppliers().map(s=>s.address).filter(Boolean))].sort());
  readonly busy = signal(false); readonly error = signal(''); readonly formOpen = signal(false);
  editingId?: number;
  draft = {supplier_name: '', email: '', phone: '', address: ''};
  edit(s?: Supplier) {
    if (this.busy() || !this.data.permissions().manageCatalog) return;
    this.editingId = s?.supplier_id;
    this.draft = s ? {supplier_name: s.supplier_name, email: s.email, phone: s.phone, address: s.address} : {supplier_name: '', email: '', phone: '', address: ''};
    this.error.set(''); this.formOpen.set(true);
  }
  async save() {
    if (this.busy() || this.data.loading()) return;
    this.busy.set(true); this.error.set('');
    try { await this.data.saveSupplier(this.draft, this.editingId); this.formOpen.set(false); }
    catch(e) { this.error.set((e as Error).message); } finally { this.busy.set(false); }
  }
  async remove(s: Supplier) {
    if (this.busy() || !confirm(this.text('Delete supplier {name}?', {name: s.supplier_name}))) return;
    this.busy.set(true); this.error.set('');
    try { await this.data.deleteSupplier(s.supplier_id); } catch(e) { this.error.set((e as Error).message); } finally { this.busy.set(false); }
  }

  readonly data = inject(Store);
  readonly query = signal("");
  readonly canOrder = computed(() => this.data.canWrite() && this.data.permissions().createOrders);
  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.data.suppliers().filter(supplier=>!this.address() || supplier.address === this.address()).filter((supplier) =>
      [supplier.supplier_name, supplier.address, supplier.email, supplier.phone]
        .some((field) => field.toLowerCase().includes(query)),
    );
  });
}
