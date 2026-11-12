import { Auth } from '../auth';
import { Component, inject } from '@angular/core';
import { StatCard } from '../components/stat-card';
import { RouterLink } from '@angular/router';
import { Store } from '../store';
import { WorkspaceStatus } from './workspace-status';
import { AccessPrompt } from './access-prompt';
@Component({imports:[RouterLink,StatCard,WorkspaceStatus,AccessPrompt],host:{class:'dashboard-page'},styles:[`:host{display:grid;gap:24px;min-width:0}.hero .actions{margin-top:4px}`],template:`
<section class="hero" aria-labelledby="home-title"><div class="hero-copy"><p class="eyebrow">SUPPLIER &amp; PURCHASING MANAGEMENT</p><h1 id="home-title">Purchasing, made simple.</h1><p>Jedel.Group connects supplier records, product catalogs, procurement approval and reliable inventory receipts in one team workspace.</p>
<div class="actions"><a class="button" routerLink="/products">Browse products</a>
@if(auth.user()?.capabilities?.create_orders) {<a class="button secondary" routerLink="/orders/new">Create an order</a>} @else {<a class="button secondary" routerLink="/orders">Explore the workflow</a>}
</div></div><aside class="hero-overview"><h2>Workspace overview</h2><p>Explore the public catalog and procurement workflow. Authorized team members use the live dashboard below.</p><ol class="overview-list"><li>Prepare Pending orders</li><li>Approve eligible purchases</li><li>Receive stock once on delivery</li></ol></aside></section>
@if(auth.user()?.capabilities?.read) {
 <app-workspace-status />
 @if(data.loading()) {<section class="stats" aria-label="Overview"><app-stat-card label="Products" [loading]="true"/><app-stat-card label="Suppliers" [loading]="true"/><app-stat-card label="Purchase orders" [loading]="true"/></section>}
 @else if(!data.error()) { @if(data.dashboard(); as dashboard) {
  <section class="stats" aria-label="Overview"><app-stat-card label="Products" [value]="dashboard.productCount"/><app-stat-card label="Suppliers" [value]="dashboard.supplierCount"/><app-stat-card label="Purchase orders" [value]="dashboard.orderCount"/></section>
  <section class="stats" aria-label="Purchasing metrics"><app-stat-card label="Purchasing commitments" [value]="dashboard.purchasingValue" format="money" unit="KZT" description="Non-cancelled procurement value"/><app-stat-card label="Delivered order value" [value]="dashboard.deliveredValue" format="money" unit="KZT" description="Confirmed receipts, not payments"/><app-stat-card label="Current inventory" [value]="dashboard.stockUnits" unit="units" description="Authorized warehouse quantities"/></section>
  <p class="hint">Commitments include non-cancelled orders. Delivered order value reflects receipts, not actual payments.</p>
  <section class="panel"><h2>Low stock</h2><p class="hint">Products at or below the current {{data.lowStockThreshold()}}-unit report threshold.</p><ul class="stock-list">@for(product of dashboard.lowStock; track product.product_id) {<li><span class="stock-name">{{product.product_name}}</span><span class="stock-quantity"><strong>{{product.stock_quantity}}</strong><span>units</span></span></li>} @empty {<li class="empty-state">No products at or below the current threshold.</li>}</ul></section>
 } @else {<p class="panel empty-state">Dashboard data is unavailable. Refresh the workspace to retrieve current metrics.</p>}}
}
<section class="home-shortcuts" aria-labelledby="sections-title"><h2 id="sections-title">Explore the workspace</h2><div class="cards">
@for(link of sections; track link.path) {<article class="panel shortcut"><h3><a [routerLink]="link.path">{{link.title}}</a></h3><p>{{link.description}}</p></article>}
</div></section>
<section class="panel"><h2>How purchasing works</h2><ol><li>Authorized employees maintain suppliers and prepare Pending orders with captured prices.</li><li>Managers approve eligible orders without changing stock.</li><li>Confirmed full delivery updates stock and final status atomically, once.</li><li>Authorized reports explain commitments and inventory; no retail checkout or payment ledger is implied.</li></ol></section>
@if(!auth.user()?.capabilities?.read) {<app-access-prompt section="orders" />}
`})
export class HomePage {
 readonly data=inject(Store); readonly auth=inject(Auth);
 readonly sections=[
  {path:'/products',title:'Products',description:'Browse public product names and categories. Authorized teams manage catalog fields and inventory visibility.'},
  {path:'/suppliers',title:'Suppliers',description:'Learn supplier-directory practices while private company contacts remain protected.'},
  {path:'/orders',title:'Orders',description:'Understand Pending, Approved, Delivered and Cancelled procurement states and authorized actions.'},
  {path:'/analytics',title:'Analytics',description:'Explore report definitions; authorized users see real purchasing commitments, receipts and inventory summaries.'},
 ];
}
