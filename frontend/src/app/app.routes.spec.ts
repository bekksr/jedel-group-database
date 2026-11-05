import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { ERP_DATA } from './core/data/models';
import { DemoDataService } from './core/data/demo-data.service';
import { SuppliersPage } from './features/suppliers/suppliers.page';
import { ProductsPage } from './features/products/products.page';
import { PurchaseOrdersPage } from './features/purchase-orders/purchase-orders.page';
import { SettingsPage } from './features/settings/settings.page';

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
});
describe('ERP routes and interactions', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: ERP_DATA, useClass: DemoDataService }],
    }),
  );
  it('loads every feature route, the default route, and unknown-path fallback', async () => {
    const harness = await RouterTestingHarness.create();
    const headings = {
      dashboard: 'Purchasing, at a glance.',
      suppliers: 'Suppliers',
      products: 'Products',
      'purchase-orders': 'Purchase orders',
      analytics: 'Purchasing analytics',
      settings: 'Settings',
    };
    for (const [path, heading] of Object.entries(headings)) {
      await harness.navigateByUrl('/' + path);
      harness.detectChanges();
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(heading);
      for (const region of harness.routeNativeElement?.querySelectorAll('.table-scroll') ?? []) {
        expect(region.getAttribute('tabindex')).toBe('0');
        expect(region.getAttribute('aria-label')).toBeTruthy();
      }
    }
    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement?.textContent).toContain('Purchasing, at a glance.');
    await harness.navigateByUrl('/unknown');
    expect(harness.routeNativeElement?.textContent).toContain('Purchasing, at a glance.');
  });
  it('validates supplier form and performs add, search, edit, sort, and deletion', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/suppliers', SuppliersPage);
    page.open();
    await page.save();
    expect(page.form.invalid).toBe(true);
    expect(page.data.suppliers().length).toBe(3);
    page.form.setValue({
      supplier_name: 'Test supplier',
      email: 'test@example.com',
      phone: '',
      address: 'Test address',
    });
    await page.save();
    page.search('test@');
    expect(page.filtered().length).toBe(1);
    const supplier = page.filtered()[0];
    expect(supplier).toBeDefined();
    if (!supplier) return;
    page.open(supplier);
    page.form.controls.supplier_name.setValue('Updated test');
    await page.save();
    expect(
      page.data.suppliers().find((s) => s.supplier_id === supplier.supplier_id)?.supplier_name,
    ).toBe('Updated test');
    page.sortBy('email');
    page.askDelete(supplier);
    await page.remove();
    expect(page.data.suppliers().length).toBe(3);
    page.search('not-found');
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No results found');
  });
  it('filters and sorts products, validates prices, and preserves stock', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/products', ProductsPage);
    page.filter('Electronics');
    expect(page.filtered().length).toBe(2);
    page.search('laptop');
    expect(page.filtered().length).toBe(1);
    const product = page.filtered()[0];
    if (!product) throw new Error('Missing SQL product');
    page.open(product);
    page.form.controls.unit_price.setValue(-1);
    await page.save();
    expect(page.form.invalid).toBe(true);
    page.form.controls.unit_price.setValue(400000);
    await page.save();
    expect(
      page.data.products().find((p) => p.product_id === product.product_id)?.stock_quantity,
    ).toBe(17);
    page.search('');
    page.sortBy('unit_price');
    expect(page.filtered()[0]?.unit_price).toBe(12000);
  });
  it('creates multiple order lines, calculates totals, and confirms delivery', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/purchase-orders', PurchaseOrdersPage);
    page.open();
    await page.save();
    expect(page.form.invalid).toBe(true);
    page.form.patchValue({
      supplier_id: 1,
      order_date: '2026-11-06',
      expected_delivery_date: '2026-11-07',
    });
    page.itemControls.at(0).setValue({ product_id: 1, quantity: 2 });
    page.addItem();
    page.itemControls.at(1).setValue({ product_id: 2, quantity: 1 });
    expect(page.draftTotal()).toBe(785000);
    await page.save();
    const order = page.selected();
    if (!order) throw new Error('Order was not created');
    expect(page.total(order.order_id)).toBe(785000);
    page.askTransition(order, 'Approved');
    await page.confirmTransition();
    expect(page.selected()?.status).toBe('Approved');
    page.askTransition(page.selected()!, 'Delivered');
    await page.confirmTransition();
    expect(page.selected()?.status).toBe('Delivered');
    expect(page.data.products().find((p) => p.product_id === 1)?.stock_quantity).toBe(19);
    page.filter('Pending');
    expect(page.filtered().length).toBe(0);
    harness.detectChanges();
  });
  it('opens quick actions and order details from deep links', async () => {
    const harness = await RouterTestingHarness.create();
    const suppliers = await harness.navigateByUrl('/suppliers?action=new', SuppliersPage);
    expect(suppliers.formOpen()).toBe(true);
    const orders = await harness.navigateByUrl('/purchase-orders?order=1', PurchaseOrdersPage);
    expect(orders.selected()?.order_id).toBe(1);
  });
  it('applies a real preference change and resets the demo', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/settings', SettingsPage);
    page.form.controls.threshold.setValue(10);
    await page.save();
    expect(page.data.lowStockThreshold()).toBe(10);
    expect(page.saved()).toBe(true);
    page.reset();
    expect(page.data.lowStockThreshold()).toBe(20);
  });
  it('paginates suppliers and resets the page when searching', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/suppliers', SuppliersPage);
    for (let i = 0; i < 4; i++)
      page.data.saveSupplier({
        supplier_name: `Test ${i}`,
        email: `test${i}@example.com`,
        phone: '',
        address: '',
      });
    expect(page.rows().length).toBe(5);
    page.page.set(2);
    expect(page.rows().length).toBe(2);
    page.search('Techno');
    expect(page.page()).toBe(1);
    expect(page.rows().length).toBe(1);
  });
  it('associates invalid controls with visible error text and required semantics', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/suppliers', SuppliersPage);
    page.open();
    await page.save();
    harness.detectChanges();
    const input = harness.routeNativeElement?.querySelector<HTMLInputElement>(
      'input[formControlName="supplier_name"]',
    );
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-required')).toBe('true');
    const id = input?.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toContain('required');
  });
  it('restores focus to the opener after closing a dialog', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/suppliers', SuppliersPage);
    const opener =
      harness.routeNativeElement?.querySelector<HTMLButtonElement>('.page-heading button');
    opener?.focus();
    page.open();
    harness.detectChanges();
    harness.routeNativeElement?.querySelector<HTMLInputElement>('dialog input')?.focus();
    page.formOpen.set(false);
    harness.detectChanges();
    await Promise.resolve();
    expect(document.activeElement).toBe(opener);
  });
  it('clamps pagination after refreshed records shrink the result set', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/suppliers', SuppliersPage);
    for (let i = 0; i < 4; i++)
      page.data.saveSupplier({
        supplier_name: `Test ${i}`,
        email: `qa${i}@example.test`,
        phone: '',
        address: '',
      });
    page.page.set(2);
    expect(page.rows().length).toBe(2);
    for (const supplier of page.data.suppliers().filter((s) => s.email.endsWith('@example.test')))
      await page.data.deleteSupplier(supplier.supplier_id);
    expect(page.currentPage()).toBe(1);
    expect(page.rows().length).toBe(3);
  });
});
