import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Store } from '../store';
import { WorkspaceStatus } from './workspace-status';
import { StatCard, MONEY_DIGITS } from '../components/stat-card';
@Component({selector:'ng-component-analytics',imports:[DecimalPipe,WorkspaceStatus,StatCard],host:{class:'analytics-page'},styleUrl:'./analytics.scss',template:`
<header><h1>Analytics</h1><p class="subtitle">Company purchasing and inventory reports from the authorized workspace.</p></header>
<app-workspace-status />
@if(data.loading()) {
 <section class="stats" aria-label="Report summaries"><app-stat-card label="Purchasing commitments" [loading]="true"/><app-stat-card label="Delivered order value" [loading]="true"/><app-stat-card label="Inventory units" [loading]="true"/></section>
} @else if(!data.error()) {
 <aside class="note report-notice" aria-label="Report definitions">Purchasing commitments include Pending, Approved and Delivered orders and exclude Cancelled orders. Supplier spending uses captured item prices. Delivered value reflects receipts; these figures are not actual payments.</aside>
 @if(data.dashboard(); as dashboard) {
  <section class="stats" aria-label="Report summaries"><app-stat-card label="Purchasing commitments" [value]="dashboard.purchasingValue" format="money" unit="KZT" description="Non-cancelled procurement value"/><app-stat-card label="Delivered order value" [value]="dashboard.deliveredValue" format="money" unit="KZT" description="Confirmed receipts, not payments"/><app-stat-card label="Inventory units" [value]="dashboard.stockUnits" unit="units" description="Authorized warehouse quantities"/></section>
  <div class="report-grid">
   <section class="panel"><div class="report-heading"><h2>Inventory summary</h2><span class="report-count">{{dashboard.productCount | number:'1.0-0'}} products</span></div>
    <h3>Low stock at or below {{data.lowStockThreshold()}} units</h3><p class="hint">Uses the current report threshold; no demand forecast is inferred.</p>
    <ul class="stock-list">@for(product of dashboard.lowStock;track product.product_id) {<li><span class="stock-name">{{product.product_name}}</span><span class="stock-quantity"><strong>{{product.stock_quantity | number:'1.0-0'}}</strong><span>units</span></span></li>} @empty {<li class="empty-state">No products at or below the threshold.</li>}</ul>
   </section>
   <section class="panel"><h2>Order status distribution</h2><p class="hint">Current records grouped by procurement state.</p><dl class="status-list">@for(row of data.orderStatuses();track row.status) {<div><dt><span class="badge" [attr.data-status]="row.status">{{row.status}}</span></dt><dd>{{row.count | number:'1.0-0'}}</dd></div>} @empty {<div><dt class="empty-state">No orders to report.</dt></div>}</dl></section>
  </div>
 } @else {<p class="panel empty-state">Summary data is unavailable. Refresh the workspace to retrieve current metrics.</p>}
 <section class="panel"><h2>Supplier spending</h2><p class="hint">Non-cancelled purchasing commitments grouped by supplier, not paid invoices.</p><div class="report-table" tabindex="0" role="region" aria-label="Supplier spending"><table><thead><tr><th scope="col">Supplier</th><th scope="col" class="numeric">Orders</th><th scope="col" class="numeric">Total KZT</th></tr></thead><tbody>@for(row of data.supplierSpending(); track row.label) {<tr><th scope="row">{{row.label}}</th><td class="numeric">{{row.orders | number:'1.0-0'}}</td><td class="numeric money">{{row.value | number:moneyDigits}} <span class="currency">KZT</span></td></tr>} @empty {<tr><td colspan="3" class="empty-state">No spending data.</td></tr>}</tbody></table></div></section>
 <section class="panel"><h2>Monthly order activity</h2><p class="hint">Counts use order dates across all statuses, not delivery or payment dates. Only recorded months are shown.</p>@if(monthlyActivity().length > 1) {<ul class="activity-list">@for(month of monthlyActivity();track month.period) {<li><span>{{month.period}}</span><span><strong>{{month.orders | number:'1.0-0'}}</strong> order(s)</span></li>}</ul>} @else {<p class="empty-state">At least two months of dated orders are needed to show an activity trend.</p>}</section>
}
`})
export class AnalyticsPage {
 readonly data=inject(Store);
 readonly moneyDigits=MONEY_DIGITS;
 readonly monthlyActivity=computed(()=>{
  const months=new Map<string,number>();
  for(const order of this.data.orders()) {const period=order.order_date.slice(0,7);months.set(period,(months.get(period) ?? 0)+1);}
  return [...months].sort(([a],[b])=>a.localeCompare(b)).map(([period,orders])=>({period,orders}));
 });
}
