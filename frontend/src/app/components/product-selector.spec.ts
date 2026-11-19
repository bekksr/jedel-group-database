import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProductSelector } from './product-selector';

describe('searchable product selector', () => {
  it('searches all 55 products and emits the selected product ID', async () => {
    const fixture = TestBed.createComponent(ProductSelector);
    fixture.componentRef.setInput('products', Array.from({length: 55}, (_, index) => ({product_id: index + 1, product_name: `[DEMO] Product ${index + 1}`, category: 'Demo', unit_price: index + 100, stock_quantity: index})));
    fixture.componentRef.setInput('index', 0);
    fixture.detectChanges();
    const chosen: number[] = [];
    fixture.componentInstance.selectedIdChange.subscribe(value => chosen.push(value));
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Product 55'; input.dispatchEvent(new Event('input')); await fixture.whenStable();
    expect(fixture.componentInstance.filtered).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Product 55');
    expect(fixture.nativeElement.textContent).toContain('154.00 KZT');
    fixture.componentInstance.key(new KeyboardEvent('keydown', {key: 'Enter'}));
    expect(chosen).toEqual([55]);
  });
  it('initializes the displayed name from a preselected ID', async () => {
    const fixture = TestBed.createComponent(ProductSelector);
    fixture.componentRef.setInput('products', [{product_id: 17, product_name: '[JEDEL FICTIONAL] Notebook', category: 'Laptops', unit_price: 100, stock_quantity: 2}]);
    fixture.componentRef.setInput('selectedId', 17);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input').value).toBe('Notebook');
    expect(fixture.nativeElement.textContent).toContain('Demo');
  });
});
