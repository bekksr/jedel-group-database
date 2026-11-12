import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Store } from '../store';
import { WorkspaceStatus } from './workspace-status';
@Component({selector:'ng-component-analytics',imports:[DecimalPipe,WorkspaceStatus],template:`<h1>Analytics</h1><p class="subtitle">Company purchasing and inventory reports from the authorized workspace.</p><app-workspace-status />
@if(!data.loading() && !data.error()) {
 <p class="note">Purchasing commitments include Pending, Approved and Delivered orders and exclude Cancelled orders. Supplier spending uses captured item prices. Delivered value reflects receipts; these figures are not actual payments.</p>
 @if(data.dashboard(); as dashboard) {
  <section class="stats" aria-label="Report summaries"><article><strong>{{dashboard.purchasingValue | number:'1.2-2'}}</strong><span>Purchasing commitments KZT</span></article><article><strong>{{dashboard.deliveredValue | number:'1.2-2'}}</strong><span>Delivered order value KZT</span></article><article><strong>{{dashboard.stockUnits}}</strong><span>Inventory units</span></article></section>
  <section class="panel"><h2>Inventory summary</h2><p>{{dashboard.productCount}} products in the authorized catalog.</p><h3>Low stock at or below {{data.lowStockThreshold()}} units</h3>@for(product of dashboard.lowStock;track product.product_id) {<p>{{product.product_name}}: {{product.stock_quantity}} units</p>} @empty {<p>No products at or below the threshold.</p>}</section>
 }
 <section class="panel"><h2>Supplier spending</h2><p>Non-cancelled purchasing commitments grouped by supplier, not paid invoices.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Supplier spending"><table><thead><tr><th>Supplier</th><th>Orders</th><th>Total KZT</th></tr></thead><tbody>@for(row of data.supplierSpending(); track row.label) {<tr><td>{{row.label}}</td><td>{{row.orders}}</td><td>{{row.value | number:'1.2-2'}}</td></tr>} @empty {<tr><td colspan="3">No spending data.</td></tr>}</tbody></table></div></section>
 <section class="panel"><h2>Order status distribution</h2>@for(row of data.orderStatuses();track row.status) {<p>{{row.status}}: {{row.count}}</p>} @empty {<p>No orders to report.</p>}</section>
 <section class="panel"><h2>Monthly order activity</h2><p>Counts use order dates across all statuses, not delivery or payment dates. Only recorded months are shown.</p>@if(monthlyActivity().length > 1) {<ul>@for(month of monthlyActivity();track month.period) {<li>{{month.period}}: {{month.orders}} order(s)</li>}</ul>} @else {<p>At least two months of dated orders are needed to show an activity trend.</p>}</section>
}
`})
export class AnalyticsPage {
 readonly data=inject(Store);
 readonly monthlyActivity=computed(()=>{
  const months=new Map<string,number>();
  for(const order of this.data.orders()) {const period=order.order_date.slice(0,7);months.set(period,(months.get(period) ?? 0)+1);}
  return [...months].sort(([a],[b])=>a.localeCompare(b)).map(([period,orders])=>({period,orders}));
 });
}
