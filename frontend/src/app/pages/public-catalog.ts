import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, EMPTY, catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap, tap } from 'rxjs';
import { PublicCatalogService, PublicProduct } from '../core/data/public-catalog.service';
import { apiError } from '../core/data/api-errors';
import { Auth } from '../auth';
@Component({selector: 'app-public-catalog', imports: [FormsModule, RouterLink], template: `
  <div class="heading"><div><h1>Products</h1><p class="subtitle">Explore the Jedel.Group product catalog.</p></div>
    @if(!auth.user()) {<a class="button secondary" routerLink="/products/new">Create product</a>}
  </div>
  <p class="hint">Product names and categories are public. Purchasing prices, inventory and supplier contacts remain private.</p>
  <div class="form-grid">
    <label>Search products<input type="search" placeholder="Name or category" [ngModel]="search()" (ngModelChange)="setSearch($event)" maxlength="100"></label>
    <label>Category<select [ngModel]="category()" (ngModelChange)="setCategory($event)"><option value="">All categories</option>@for(value of categories(); track value) {<option [value]="value">{{value}}</option>}</select></label>
  </div>
  @if(categoryError()) {<p class="error" role="alert">Categories could not be loaded. <button class="secondary" (click)="loadCategories()">Retry categories</button></p>}
  @if(loading()) {<p role="status">Loading products...</p>}
  @else if(error()) {<p class="error" role="alert">{{error()}} <button class="secondary" (click)="refresh()">Retry catalog</button></p>}
  @else {
    <p role="status">{{count()}} product(s) found.</p>
    <div class="cards" aria-label="Public product catalog">
      @for(product of products(); track product.product_id) {
        <article class="panel"><p class="eyebrow">{{product.category || 'Uncategorized'}}</p><h2>{{product.product_name}}</h2><dl><div><dt>Product ID</dt><dd>#{{product.product_id}}</dd></div></dl></article>
      } @empty {<p class="panel">No products match your search.</p>}
    </div>
    <div class="actions" aria-label="Catalog pages"><button class="secondary" [disabled]="!previous()" (click)="changePage(-1)">Previous</button><span>Page {{page()}}</span><button class="secondary" [disabled]="!next()" (click)="changePage(1)">Next</button></div>
  }
`})
export class PublicCatalogPage {
  readonly auth = inject(Auth);
  private readonly service = inject(PublicCatalogService);
  private readonly destroy = inject(DestroyRef);
  private readonly requests = new Subject<void>();
  private readonly searches = new Subject<string>();
  readonly search = signal(''); readonly category = signal(''); readonly page = signal(1);
  readonly products = signal<PublicProduct[]>([]); readonly categories = signal<string[]>([]);
  readonly loading = signal(false); readonly error = signal(''); readonly categoryError = signal(false);
  readonly count = signal(0); readonly next = signal(false); readonly previous = signal(false);
  constructor() {
    this.requests.pipe(startWith(undefined), switchMap(() => {
      this.loading.set(true); this.error.set(''); this.products.set([]);
      return this.service.products(this.search(), this.category(), this.page()).pipe(
        tap(result => {this.products.set(result.results); this.count.set(result.count); this.next.set(!!result.next); this.previous.set(!!result.previous);}),
        catchError(error => {this.error.set(apiError(error)); return EMPTY;}),
        finalize(() => this.loading.set(false)));
    }), takeUntilDestroyed(this.destroy)).subscribe();
    this.searches.pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroy)).subscribe(() => {this.page.set(1); this.refresh();});
    this.loadCategories();
  }
  setSearch(value: string) {this.search.set(value); this.searches.next(value);}
  setCategory(value: string) {this.category.set(value); this.page.set(1); this.refresh();}
  changePage(delta: number) {if (this.loading() || (delta < 0 && !this.previous()) || (delta > 0 && !this.next())) return; this.page.update(page => page + delta); this.refresh();}
  refresh() {this.requests.next();}
  loadCategories() {
    this.categoryError.set(false);
    this.service.categories().pipe(takeUntilDestroyed(this.destroy)).subscribe({next: result => this.categories.set(result.results), error: () => this.categoryError.set(true)});
  }
}
