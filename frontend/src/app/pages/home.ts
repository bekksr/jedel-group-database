import { Auth } from '../auth';
import { Component, computed, inject } from '@angular/core';
import { StatCard } from '../components/stat-card';
import { RouterLink } from '@angular/router';
import { Store } from '../store';
import { WorkspaceStatus } from './workspace-status';
import { AccessPrompt } from './access-prompt';
import { displayProductName } from '../core/data/product-metadata';
import { UiLanguage } from '../core/ui-language';
@Component({imports:[RouterLink,StatCard,WorkspaceStatus,AccessPrompt],host:{class:'dashboard-page'},styles:[`:host{display:grid;gap:var(--section-gap);min-width:0}.hero .actions{margin-top:4px}`],template:`
<section class="hero" aria-labelledby="home-title"><div class="hero-copy"><p class="eyebrow">{{ text('SUPPLIER & PURCHASING MANAGEMENT') }}</p><h1 id="home-title">{{ text('Purchasing, made simple.') }}</h1><p>{{ text('Jedel.Group connects supplier records, product catalogs, procurement approval and reliable inventory receipts in one team workspace.') }}</p>
<div class="actions"><a class="button" routerLink="/products">{{ text('Browse products') }}</a>
@if(auth.user()?.capabilities?.create_orders) {<a class="button secondary" routerLink="/orders/new">{{ text('Create an order') }}</a>} @else {<a class="button secondary" routerLink="/orders">{{ text('Explore the workflow') }}</a>}
</div></div><aside class="hero-overview"><h2>{{ text('Workspace overview') }}</h2><p>{{ text('Explore the public catalog and procurement workflow. Authorized team members use the live dashboard below.') }}</p><ol class="overview-list"><li>{{ text('Prepare Pending orders') }}</li><li>{{ text('Approve eligible purchases') }}</li><li>{{ text('Receive stock once on delivery') }}</li></ol></aside></section>
@if(auth.user()?.capabilities?.read) {
 <app-workspace-status />
 @if(data.loading()) {<section class="stats" [attr.aria-label]="text('Overview')"><app-stat-card label="Products" [loading]="true"/><app-stat-card label="Suppliers" [loading]="true"/><app-stat-card label="Purchase orders" [loading]="true"/></section>}
 @else if(!data.error()) { @if(data.dashboard(); as dashboard) {
  <section class="stats" [attr.aria-label]="text('Overview')"><app-stat-card label="Products" [value]="dashboard.productCount"/><app-stat-card label="Suppliers" [value]="dashboard.supplierCount"/><app-stat-card label="Purchase orders" [value]="dashboard.orderCount" [description]="text('Awaiting approval · {count}', {count: pendingOrders()})"/></section>
  <section class="stats" [attr.aria-label]="text('Purchasing metrics')"><app-stat-card label="Purchasing commitments" [value]="dashboard.purchasingValue" format="money" unit="KZT" description="Non-cancelled procurement value"/><app-stat-card label="Delivered order value" [value]="dashboard.deliveredValue" format="money" unit="KZT" description="Confirmed receipts, not payments"/><app-stat-card label="Current inventory" [value]="dashboard.stockUnits" unit="units" description="Authorized warehouse quantities"/></section>
  <p class="hint">{{ text('Commitments include non-cancelled orders. Delivered order value reflects receipts, not actual payments.') }}</p>
  <section class="panel"><h2>{{ text('Low stock') }}</h2><p class="hint">{{ text('Products at or below the current {threshold}-unit report threshold.', {threshold: data.lowStockThreshold()}) }}</p><ul class="stock-list">@for(product of dashboard.lowStock; track product.product_id) {<li><span class="stock-name">{{displayName(product.product_name)}}</span><span class="stock-quantity"><strong>{{product.stock_quantity}}</strong><span>{{ text('units') }}</span></span></li>} @empty {<li class="empty-state">{{ text('No products at or below the current threshold.') }}</li>}</ul></section>
 } @else {<p class="panel empty-state">{{ text('Dashboard data is unavailable. Refresh the workspace to retrieve current metrics.') }}</p>}}
}
<section class="home-shortcuts" aria-labelledby="sections-title"><h2 id="sections-title">{{ text('Explore the workspace') }}</h2><div class="cards">
@for(link of visibleSections(); track link.path) {<article class="panel shortcut"><h3><a [routerLink]="link.path">{{ text(link.title) }}</a></h3><p>{{ text(link.description) }}</p></article>}
</div></section>
<section class="panel"><h2>{{ text('How purchasing works') }}</h2><ol><li>{{ text('Authorized employees maintain suppliers and prepare Pending orders with captured prices.') }}</li><li>{{ text('Managers approve eligible orders without changing stock.') }}</li><li>{{ text('Confirmed full delivery updates stock and final status atomically, once.') }}</li><li>{{ text('Authorized reports explain commitments and inventory; no retail checkout or payment ledger is implied.') }}</li></ol></section>
@if(!auth.user()?.capabilities?.read) {<app-access-prompt section="orders" />}
`})
export class HomePage {
 readonly text = inject(UiLanguage).text;
 readonly displayName=displayProductName;
 readonly data=inject(Store); readonly auth=inject(Auth);
 readonly pendingOrders = computed(() =>
  this.data.dashboard()?.statuses.find(row => row.status === 'Pending')?.count ?? 0,
 );
 readonly sections=[
  {path:'/products',title:'Products',description:'Browse public product names and categories. Authorized teams manage catalog fields and inventory visibility.'},
  {path:'/suppliers',title:'Suppliers',description:'Browse supplier names. Contact details are available after sign-in.'},
  {path:'/orders',title:'Orders',description:'Browse read-only purchase order summaries. Creating and changing orders requires an account.'},
  {path:'/analytics',title:'Analytics',description:'Explore report definitions; authorized users see real purchasing commitments, receipts and inventory summaries.'},
 ];
 readonly visibleSections=computed(()=>{const read=!!this.auth.user()?.capabilities?.read;return this.sections.filter(section=>read||section.path!='/analytics');});
}
