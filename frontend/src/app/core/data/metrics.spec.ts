import { TestBed } from "@angular/core/testing";
import { ERP_DATA } from "./models";
import { DemoDataService } from "./demo-data.service";
import { useMetrics } from "./metrics";

describe("Derived purchasing analytics", () => {
  it("updates charts and totals after cancellations and threshold changes", () => {
    const data = new DemoDataService();
    TestBed.configureTestingModule({
      providers: [{ provide: ERP_DATA, useValue: data }],
    });
    const metrics = TestBed.runInInjectionContext(() => useMetrics());
    expect(metrics.purchasingValue()).toBe(1620000);
    expect(metrics.deliveredValue()).toBe(1240000);
    expect(metrics.spending().map((s) => [s.label, s.value])).toEqual([
      ["TechnoSupply", 955000],
      ["Global Parts", 380000],
      ["Smart Logistics", 285000],
    ]);
    expect(metrics.lowStock().length).toBe(3);
    data.transitionOrder(2, "Cancelled");
    expect(metrics.purchasingValue()).toBe(1240000);
    expect(
      metrics.statusCounts().find((s) => s.status === "Cancelled")?.count,
    ).toBe(1);
    expect(
      metrics.spending().find((s) => s.label === "Global Parts")?.value,
    ).toBe(0);
    data.setLowStockThreshold(10);
    expect(metrics.lowStock().length).toBe(0);
  });
});
