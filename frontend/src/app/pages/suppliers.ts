import { WorkspaceStatus } from './workspace-status';
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Supplier } from "../models";
import { Store } from "../store";
@Component({selector: "ng-component-suppliers",
  imports: [WorkspaceStatus, FormsModule, RouterLink],
  template: `<h1>Suppliers</h1><app-workspace-status />
    <p class="subtitle">Find a supplier and start a purchase order.</p>
    <label class="search"
      >Search suppliers<input
        type="search"
        [ngModel]="query()"
        (ngModelChange)="query.set($event)"
        placeholder="Name, email, phone or address"
    /></label>
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
    <div class="cards">
      @for (s of filtered(); track s.supplier_id) {
        <article class="panel">
          <h2>{{ s.supplier_name }}</h2>
          @if(data.permissions().manageCatalog) { <button [disabled]="busy() || data.loading()" (click)="edit(s)">Edit</button> }
          @if(data.permissions().deleteRecords) { <button [disabled]="busy() || data.loading()" (click)="remove(s)">Delete</button> }
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{{ s.email }}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{{ s.phone || "—" }}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{{ s.address || "—" }}</dd>
            </div>
          </dl>
          @if(data.permissions().createOrders) {
          <a
            class="button secondary"
            routerLink="/orders"
            [queryParams]="{ new: 1, supplier: s.supplier_id }"
            >Choose supplier</a
          >
          }
        </article>
      } @empty {
        @if(!data.loading() && !data.error()) {<p class="panel">No suppliers match your search.</p>}
      }
    </div>`,
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
  readonly data = inject(Store);
  readonly query = signal("");
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
  readonly filtered = computed(() =>
    this.data
      .suppliers()
      .filter(s=>!this.address() || s.address === this.address())
      .filter((s) =>
        (s.supplier_name + " " + s.email + " " + s.phone + " " + s.address)
          .toLowerCase()
          .includes(this.query().trim().toLowerCase()),
      ),
  );
}
