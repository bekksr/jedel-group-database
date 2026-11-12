import { WorkspaceStatus } from './workspace-status';
import { Supplier } from '../models';
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Store } from "../store";

@Component({selector:"ng-component-suppliers",
  imports: [WorkspaceStatus, FormsModule, RouterLink],
  template: `
    <h1>Suppliers</h1><app-workspace-status />
    @if(data.permissions().manageCatalog) {
      <button [disabled]="busy() || data.loading()" (click)="edit()">New supplier</button>
      @if(formOpen()) {
        <form class="panel narrow" (ngSubmit)="save()">
          <h2>{{editingId === undefined ? 'New supplier' : 'Edit supplier'}}</h2>
          <label>Supplier name<input name="supplier_name" [(ngModel)]="draft.supplier_name" required maxlength="100"></label>
          <label>Email<input name="email" type="email" [(ngModel)]="draft.email" required maxlength="100"></label>
          <label>Phone<input name="phone" [(ngModel)]="draft.phone" maxlength="20"></label>
          <label>Address<input name="address" [(ngModel)]="draft.address" maxlength="255"></label>
          <button [disabled]="busy() || data.loading()">Save supplier</button>
          <button type="button" [disabled]="busy()" (click)="formOpen.set(false)">Cancel</button>
        </form>
      }
    }
    @if(error()) { <p class="error" role="alert">{{error()}}</p> }
    <label>Address filter<select [ngModel]="address()" (ngModelChange)="address.set($event)"><option value="">All addresses</option>@for(value of addresses();track value) {<option [value]="value">{{value}}</option>}</select></label>

    <p class="subtitle">Search the directory and choose a supplier for your order.</p>
    @if (data.loading()) {
      <p class="panel" role="status">Loading suppliers…</p>
    } @else if (data.error()) {
      <p class="panel">Restore the business connection using Retry workspace above.</p>
    } @else {
      <div class="catalog-toolbar">
        <label>Search suppliers
          <input
            type="search"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
            placeholder="Name, address, email, or phone"
          />
        </label>
        <p class="result-count" role="status">{{ filtered().length }} of {{ data.suppliers().length }} suppliers</p>
      </div>

      <div class="cards catalog-cards">
        @for (supplier of filtered(); track supplier.supplier_id) {
          <article class="panel catalog-card">
            <h2>{{ supplier.supplier_name }}</h2><div class="actions">@if(data.permissions().manageCatalog) {<button type="button" class="secondary" [disabled]="busy() || data.loading()" (click)="edit(supplier)">Edit</button>}@if(data.permissions().deleteRecords) {<button type="button" class="secondary" [disabled]="busy() || data.loading()" (click)="remove(supplier)">Delete</button>}</div>
            <dl class="contact-details">
              <div><dt>Address</dt><dd>{{ supplier.address || "Not listed" }}</dd></div>
              <div><dt>Email</dt><dd>{{ supplier.email }}</dd></div>
              <div><dt>Phone</dt><dd>{{ supplier.phone || "Not listed" }}</dd></div>
            </dl>
            @if (canOrder()) {
              <a class="button secondary card-action" routerLink="/orders" [queryParams]="{ new: 1, supplier: supplier.supplier_id }">
                Choose supplier
              </a>
            }
          </article>
        } @empty {
          <div class="panel empty-state">
            @if (query()) {
              <p>No suppliers match your search.</p>
              <button type="button" class="secondary" (click)="query.set('')">Clear search</button>
            } @else {
              <p>No suppliers are available in this workspace.</p>
            }
          </div>
        }
      </div>
    }
  `,
})
export class SuppliersPage {
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
    if (this.busy() || !confirm('Delete supplier ' + s.supplier_name + '?')) return;
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
