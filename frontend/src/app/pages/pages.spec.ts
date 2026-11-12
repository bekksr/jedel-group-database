import { of } from 'rxjs';
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
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({mode: 'register'})),
            snapshot: {
              data: {},
              queryParamMap: convertToParamMap({
                new: 1,
                supplier: 2,
                product: 3,
              }),
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
