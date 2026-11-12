import { BehaviorSubject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../auth';
import { vi } from 'vitest';
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { Store } from "../store";
import { TestBed } from "@angular/core/testing";
import {
  provideRouter,
  ActivatedRoute,
  convertToParamMap,
} from "@angular/router";
import { describe, expect, it, beforeEach } from "vitest";
import { RegisterPage } from "./register";
import { OrdersPage } from "./orders";
import { ProductsPage } from "./products";
import { SuppliersPage } from "./suppliers";
import { HomePage } from "./home";
describe("Pages", () => {
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(async () => {
    queryParams = new BehaviorSubject(convertToParamMap({mode:"register",new:1,supplier:2,product:3}));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams,
            snapshot: {
              data: {},
              queryParamMap: queryParams.value,
            },
          },
        },
      ],
    });
    await TestBed.inject(Store).useDemo();
  });
  it("renders every page", async () => {
    for (const page of [
      HomePage,
      ProductsPage,
      SuppliersPage,
      OrdersPage,
      RegisterPage,
    ]) {
      const f = TestBed.createComponent(page as typeof HomePage);
      await f.whenStable();
      expect(f.nativeElement.querySelector("h1")).toBeTruthy();
      f.destroy();
    }
  });
  it("prefills supplier/product and creates the selected order", async () => {
    const f = TestBed.createComponent(OrdersPage);
    await f.whenStable();
    await f.whenStable();
    const p = f.componentInstance;
    expect(p.form.controls.supplier_id.value).toBe(2);
    expect(p.items.at(0).controls.product_id.value).toBe(3);
    await p.save();
    await f.whenStable();
    expect(p.selected()?.supplier_id).toBe(2);
    expect(p.formOpen()).toBe(false);
    expect(f.nativeElement.textContent).toContain("Order #4");
  });
  it("retains a rejected draft and shows its error", async () => {
    const f = TestBed.createComponent(OrdersPage);
    await f.whenStable();
    const p = f.componentInstance;
    p.items.push(p.itemGroup());
    p.items.at(1).patchValue({ product_id: 3 });
    await p.save();
    await f.whenStable();
    expect(p.formOpen()).toBe(true);
    expect(p.items.length).toBe(2);
    expect(f.nativeElement.querySelector("[role=alert]").textContent).toContain(
      "only once",
    );
  });
  it("updates the order prefill when the route query changes", async () => {
    const f = TestBed.createComponent(OrdersPage);
    await f.whenStable();
    queryParams.next(convertToParamMap({ new: 1, supplier: 1, product: 2 }));
    await f.whenStable();
    expect(f.componentInstance.form.controls.supplier_id.value).toBe(1);
    expect(f.componentInstance.items.at(0).controls.product_id.value).toBe(2);
  });
  it("filters products by description and category and resolves suppliers from orders", () => {
    const p = TestBed.createComponent(ProductsPage).componentInstance;
    p.query.set(" PORTABLE ");
    expect(p.filtered().map((product) => product.product_id)).toEqual([1]);
    p.category.set("Furniture");
    expect(p.filtered()).toHaveLength(0);
    expect([...p.purchasingSuppliers().get(3)!].map((supplier) => supplier.supplier_id).sort()).toEqual([2, 3]);
  });
  it("finds suppliers by contact details", () => {
    const p = TestBed.createComponent(SuppliersPage).componentInstance;
    p.query.set(" GLOBAL@EXAMPLE.COM ");
    expect(p.filtered().map((supplier) => supplier.supplier_id)).toEqual([2]);
  });
  it('previews captured prices for existing Pending items and current prices for new orders', async () => {
    const fixture = TestBed.createComponent(OrdersPage); await fixture.whenStable();
    const page = fixture.componentInstance;
    vi.spyOn(page.data, 'products').mockReturnValue([{product_id:1,product_name:'Price snapshot fixture',category:'Test',unit_price:99,stock_quantity:0}]);
    vi.spyOn(page.data, 'items').mockReturnValue([{item_id:1,order_id:42,product_id:1,quantity:2,unit_price:10}]);
    page.items.at(0).patchValue({product_id:1,quantity:2});
    page.editingId.set(42); expect(page.draftTotal()).toBe(20);
    page.editingId.set(null); expect(page.draftTotal()).toBe(198);
  });
  it("rejects invalid registration and mismatched passwords then clears passwords", async () => {
    vi.spyOn(TestBed.inject(Auth), "register").mockResolvedValue(undefined);
    const p = TestBed.createComponent(RegisterPage).componentInstance;
    await p.submit();
    expect(p.success()).toBe(false);
    p.form.setValue({
      name: "Test User",
      email: "test@example.com",
      password: "test12345",
      confirm: "different",
    });
    await p.submit();
    expect(p.fieldError("confirm")).toContain("match");
    p.form.controls.confirm.setValue("test12345");
    await p.submit();
    expect(p.success()).toBe(true);
    expect(p.form.controls.password.value).toBe("");
    expect(p.form.controls.confirm.value).toBe("");
  });
  it('never reports successful registration when account schema setup is missing', async () => {
    vi.spyOn(TestBed.inject(Auth), 'register').mockRejectedValue(new HttpErrorResponse({status: 503, error: {code: 'authentication_setup_required'}}));
    const page = TestBed.createComponent(RegisterPage).componentInstance;
    page.form.setValue({name: 'Applicant', email: 'applicant@example.test', password: 'Valid-password-982!x', confirm: 'Valid-password-982!x'});
    await page.submit();
    expect(page.success()).toBe(false);
    expect(page.error()).toContain('database setup');
    expect(page.form.controls.password.value).toBe('Valid-password-982!x');
  });

});
