import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Product } from '../models';
import { displayProductName } from '../core/data/product-metadata';

@Component({selector: 'app-product-selector', imports: [FormsModule, DecimalPipe], template: `
  <div class="product-selector">
    <label [attr.for]="'product-search-' + index">Product {{index + 1}}</label>
    <input [id]="'product-search-' + index" type="text" role="combobox" autocomplete="off"
      [attr.aria-label]="'Product ' + (index + 1)" aria-autocomplete="list" [attr.aria-expanded]="open"
      [attr.aria-controls]="'product-options-' + index" [attr.aria-activedescendant]="open && filtered.length ? optionId(active) : null"
      [ngModel]="query" [ngModelOptions]="{standalone:true}" (ngModelChange)="search($event)"
      (focus)="open = true" (keydown)="key($event)" (blur)="closeLater()" placeholder="Search products">
    @if (selectedProduct; as selected) {
      <small class="selector-selection">{{selected.unit_price | number:'1.2-2'}} KZT · {{selected.stock_quantity}} in stock</small>
    }
    @if(open) {
      <div class="product-options" role="listbox" [id]="'product-options-' + index">
        @for(product of filtered; track product.product_id; let i = $index) {
          <div role="option" class="product-option" [id]="optionId(i)" [attr.aria-selected]="i === active" (mousedown)="$event.preventDefault()" (click)="choose(product)">
            <span>{{displayName(product.product_name)}}</span>
            <small>{{product.category || 'Uncategorized'}} · {{product.unit_price | number:'1.2-2'}} KZT · {{product.stock_quantity}} in stock</small>
          </div>
        } @empty {<p class="selector-empty">No matching products.</p>}
      </div>
    }
  </div>
`})
export class ProductSelector implements OnChanges {
  @Input() products: readonly Product[] = [];
  @Input() selectedId = 0;
  @Input() index = 0;
  @Output() selectedIdChange = new EventEmitter<number>();
  readonly displayName = displayProductName;
  query = ''; open = false; active = 0;
  get selectedProduct() { return this.products.find(p => p.product_id === this.selectedId); }
  get filtered() { const term = this.query.trim().toLocaleLowerCase(); return this.products.filter(p => displayProductName(p.product_name).toLocaleLowerCase().includes(term)); }
  ngOnChanges() { if (this.selectedProduct) this.query = displayProductName(this.selectedProduct.product_name); }
  optionId(index: number) { return `product-option-${this.index}-${index}`; }
  search(value: string) { this.query = value; this.open = true; this.active = 0; if (this.selectedId) this.selectedIdChange.emit(0); }
  choose(product: Product) { this.query = displayProductName(product.product_name); this.open = false; this.selectedIdChange.emit(product.product_id); }
  closeLater() { setTimeout(() => { this.open = false; }, 150); }
  key(event: KeyboardEvent) {
    if (event.key === 'Escape') { this.open = false; return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); this.open = true;
      this.active = Math.max(0, Math.min(this.filtered.length - 1, this.active + (event.key === 'ArrowDown' ? 1 : -1)));
    } else if (event.key === 'Enter' && this.open && this.filtered[this.active]) {
      event.preventDefault(); this.choose(this.filtered[this.active]!);
    }
  }
}
