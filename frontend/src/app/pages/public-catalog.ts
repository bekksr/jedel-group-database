import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, EMPTY, catchError, finalize, of, startWith, switchMap, tap, timer } from 'rxjs';
import { PublicCatalogService, PublicProduct, PublicProductOrdering } from '../core/data/public-catalog.service';
import { apiError } from '../core/data/api-errors';
import { displayProductName } from '../core/data/product-metadata';
import { UiLanguage } from '../core/ui-language';
@Component({selector: 'app-public-catalog', imports: [FormsModule], template: `
  <div class="heading"><div><h1>{{ text('Products') }}</h1><p class="subtitle">{{ text('Explore the Jedel.Group product catalog.') }}</p></div>
  </div>
  <p class="hint">{{ text('Product names and categories are public. Purchasing prices, inventory and supplier contacts remain private.') }}</p>
  <div class="catalog-toolbar">
    <div class="search-field">
      <label for="catalog-search">{{ text('Search products') }}</label>
      <div class="search-control">
        <input id="catalog-search" #catalogSearch type="search" [placeholder]="text('Name or category')"
          [ngModel]="search()" (ngModelChange)="setSearch($event)" maxlength="100">
        @if (search()) {
          <button type="button" class="secondary clear-search" [title]="text('Clear search')"
            [attr.aria-label]="text('Clear search')" (click)="setSearch(''); catalogSearch.focus()">×</button>
        }
      </div>
    </div>
    <label>{{ text('Category') }}<select [ngModel]="category()" (ngModelChange)="setCategory($event)"><option value="">{{ text('All categories') }}</option>@for(value of categories(); track value) {<option [value]="value">{{value}}</option>}</select></label>
    <label>{{ text('Sort by') }}
      <select [ngModel]="ordering()" (ngModelChange)="setOrdering($event)">
        <option value="product_id">{{ text('Product ID ↑') }}</option>
        <option value="-product_id">{{ text('Product ID ↓') }}</option>
      </select>
    </label>
  </div>
  @if(categoryError()) {<p class="error" role="alert">{{ text('Categories could not be loaded.') }} <button class="secondary" (click)="loadCategories()">{{ text('Retry categories') }}</button></p>}
  @if(loading()) {<p role="status">{{ text('Loading products...') }}</p>}
  @else if(error()) {<p class="error" role="alert">{{ text(error()) }} <button class="secondary" (click)="refresh()">{{ text('Retry catalog') }}</button></p>}
  @else {
    <p role="status">{{ text('{count} product(s) found.', {count: count()}) }}</p>
    <div class="cards" [attr.aria-label]="text('Public product catalog')">
      @for(product of products(); track product.product_id) {
        <article class="panel catalog-card"><p class="eyebrow">{{ product.category || text('Uncategorized') }}</p><h2>{{displayName(product.product_name)}}</h2><dl><div><dt>{{ text('Product ID') }}</dt><dd>#{{product.product_id}}</dd></div></dl></article>
      } @empty {<p class="panel empty-state">{{ text('No products match your search.') }}</p>}
    </div>
    <div class="actions catalog-pagination" [attr.aria-label]="text('Catalog pages')">
      <button class="secondary" [disabled]="!previous()" (click)="changePage(-1)">{{ text('Previous') }}</button>
      <span>{{ text('Page {page}', {page: page()}) }}</span>
      <button class="secondary" [disabled]="!next()" (click)="changePage(1)">{{ text('Next') }}</button>
    </div>
  }
`})
export class PublicCatalogPage {
  readonly displayName = displayProductName;
  readonly text = inject(UiLanguage).text;
  private readonly service = inject(PublicCatalogService);
  private readonly destroy = inject(DestroyRef);
  private readonly requests = new Subject<number>();
  readonly search = signal(''); readonly category = signal(''); readonly page = signal(1);
  readonly ordering = signal<PublicProductOrdering>('product_id');
  readonly products = signal<PublicProduct[]>([]); readonly categories = signal<string[]>([]);
  readonly loading = signal(false); readonly error = signal(''); readonly categoryError = signal(false);
  readonly count = signal(0); readonly next = signal(false); readonly previous = signal(false);
  constructor() {
    this.requests.pipe(startWith(0), switchMap(delay => {
      this.loading.set(true); this.error.set(''); this.products.set([]);
      // A new filter cancels both a pending debounce and the previous HTTP request.
      return (delay ? timer(delay) : of(0)).pipe(
        switchMap(() => this.service.products(this.search(), this.category(), this.page(), this.ordering())),
        tap(result => {this.products.set(result.results); this.count.set(result.count); this.next.set(!!result.next); this.previous.set(!!result.previous);}),
        catchError(error => {this.error.set(apiError(error)); return EMPTY;}),
        finalize(() => this.loading.set(false)));
    }), takeUntilDestroyed(this.destroy)).subscribe();
    this.loadCategories();
  }
  setSearch(value: string) {
    this.search.set(value);
    this.page.set(1);
    this.requests.next(value.trim() ? 250 : 0);
  }
  setCategory(value: string) {this.category.set(value); this.page.set(1); this.refresh();}
  setOrdering(value: PublicProductOrdering) {
    this.ordering.set(value);
    this.page.set(1);
    this.refresh();
  }
  changePage(delta: number) {if (this.loading() || (delta < 0 && !this.previous()) || (delta > 0 && !this.next())) return; this.page.update(page => page + delta); this.refresh();}
  refresh() {this.requests.next(0);}
  loadCategories() {
    this.categoryError.set(false);
    this.service.categories().pipe(takeUntilDestroyed(this.destroy)).subscribe({next: result => this.categories.set(result.results), error: () => this.categoryError.set(true)});
  }
}
