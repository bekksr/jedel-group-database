import { Auth } from '../auth';
import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '../store';
import { WorkspaceStatus } from './workspace-status';
import { AccessPrompt } from './access-prompt';
@Component({imports:[RouterLink,DecimalPipe,WorkspaceStatus,AccessPrompt],template:`
<section class="hero"><p class="eyebrow">SUPPLIER &amp; PURCHASING MANAGEMENT</p><h1>Purchasing, made simple.</h1><p>Jedel.Group connects supplier records, product catalogs, procurement approval and reliable inventory receipts in one team workspace.</p>
<a class="button" routerLink="/products">Browse products</a>
@if(auth.user()?.capabilities?.create_orders) {<a class="button secondary" routerLink="/orders/new">Create an order</a>} @else {<a class="button secondary" routerLink="/orders">Explore the workflow</a>}
</section>
@if(auth.user()?.capabilities?.read) {
 <app-workspace-status />
 @if(!data.loading() && !data.error()) { @if(data.dashboard(); as dashboard) {
  <section class="stats" aria-label="Overview"><article><strong>{{dashboard.productCount}}</strong><span>Products</span></article><article><strong>{{dashboard.supplierCount}}</strong><span>Suppliers</span></article><article><strong>{{dashboard.orderCount}}</strong><span>Purchase orders</span></article></section>
  <section class="stats" aria-label="Purchasing metrics"><article><strong>{{dashboard.purchasingValue | number:'1.2-2'}}</strong><span>Purchasing commitments KZT</span></article><article><strong>{{dashboard.deliveredValue | number:'1.2-2'}}</strong><span>Delivered order value KZT</span></article><article><strong>{{dashboard.stockUnits}}</strong><span>Current stock units</span></article></section>
  <p class="hint">Commitments include non-cancelled orders. Delivered order value reflects receipts, not actual payments.</p>
  <section class="panel"><h2>Low stock</h2><p>Products at or below {{data.lowStockThreshold()}} units.</p>@for(product of dashboard.lowStock; track product.product_id) {<p>{{product.product_name}}: {{product.stock_quantity}}</p>} @empty {<p>No products at or below the current threshold.</p>}</section>
 }}
}
<section aria-labelledby="sections-title"><h2 id="sections-title">Explore the workspace</h2><div class="cards">
@for(link of sections; track link.path) {<article class="panel"><h3><a [routerLink]="link.path">{{link.title}}</a></h3><p>{{link.description}}</p></article>}
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
