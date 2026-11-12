import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccessPrompt } from './access-prompt';
@Component({selector:'app-section-preview',imports:[RouterLink,AccessPrompt],template:`
<section class="preview-hero"><p class="eyebrow">JEDEL.GROUP ERP / {{section}}</p><h1>{{title}}</h1><p class="subtitle">{{intro}}</p></section>
@switch(section) {
 @case('suppliers') {
  <div class="cards"><article class="panel"><h2>Build reliable supplier records</h2><p>Authorized teams maintain validated supplier identities and contact details in one directory.</p></article><article class="panel"><h2>Prepare procurement</h2><p>Connect a supplier to a Pending purchase order and select products from the catalog.</p></article><article class="panel"><h2>Keep contacts private</h2><p>Supplier identities and contact records have not been approved for public publication. Emails, phone numbers and addresses are visible only in the authorized workspace.</p></article></div>
  <section class="panel"><h2>Supplier management workflow</h2><ol><li>Check the directory before adding a supplier.</li><li>Validate the name and unique email; add optional phone and address details.</li><li>Prepare a procurement order using the verified supplier record.</li><li>Preserve relationships: referenced suppliers cannot be removed.</li></ol><p>This preview does not list actual suppliers, contact details, contracts or purchase pricing.</p><a routerLink="/products">Browse the public product catalog</a></section>
 }
 @case('orders') {
  <section class="panel"><h2>Procurement, from preparation to receipt</h2><p>These are company purchases from suppliers, not customer sales orders or checkout.</p><ol class="workflow"><li><strong>Pending</strong><p>An authorized employee selects a supplier, products, positive quantities and delivery dates. Only Pending orders can be amended.</p></li><li><strong>Approved</strong><p>An authorized manager approves the order. Approval does not receive goods or change stock.</p></li><li><strong>Delivered</strong><p>A manager confirms full receipt. Stock and final status are committed together exactly once.</p></li><li><strong>Cancelled</strong><p>Eligible Pending or Approved orders can be cancelled without changing inventory.</p></li></ol></section>
  <div class="cards"><article class="panel"><h2>Captured prices</h2><p>Order lines capture the agreed purchasing price. Catalog price changes do not rewrite that snapshot.</p></article><article class="panel"><h2>Protected inventory</h2><p>Delivery uses atomic transactions and row locks. Repeated delivery is rejected; a failure rolls back receipt changes.</p></article><article class="panel"><h2>Final states stay final</h2><p>Delivered and Cancelled orders cannot be reopened or casually edited. No arbitrary stock control is exposed.</p></article></div>
  <p class="hint">You can learn the workflow here without access to company orders. No live order numbers, suppliers, quantities or costs are shown.</p>
 }
 @case('analytics') {
  <div class="cards"><article class="panel"><h2>Purchasing commitments</h2><p>Non-cancelled Pending, Approved and Delivered orders contribute captured quantity &times; unit price. These values describe procurement commitments, not payments.</p></article><article class="panel"><h2>Supplier spending report</h2><p>Compare authorized purchasing commitments grouped by supplier. Cancelled orders are excluded.</p></article><article class="panel"><h2>Receipt value</h2><p>Delivered-order value reflects confirmed full receipts. The system does not maintain a payment ledger.</p></article><article class="panel"><h2>Order status distribution</h2><p>Review counts across Pending, Approved, Delivered and Cancelled workflow states.</p></article><article class="panel"><h2>Inventory overview</h2><p>Authorized users see current units and products at or below a configured low-stock threshold.</p></article><article class="panel"><h2>Dated order activity</h2><p>When enough dated records exist, authorized users can compare monthly order activity. Order dates are not receipt or payment dates.</p></article></div>
  <section class="panel"><h2>Report definitions before figures</h2><p>No financial aggregates, supplier rankings, order counts or inventory values have been approved for public release. This is an explanation of available reports, with no fabricated chart or sample financial value.</p><a routerLink="/orders">Understand the purchasing workflow</a></section>
 }
}
<app-access-prompt [section]="section" />
`,styles:[`.preview-hero{padding:12px 0 24px;max-width:800px}.preview-hero h1{margin-bottom:10px}.workflow{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:24px;padding-left:24px}.workflow p{font-size:14px;color:var(--muted)}.panel h2{margin-top:0}`]})
export class SectionPreview {
 @Input() section='';
 get title(){return ({suppliers:'Suppliers',orders:'Purchase orders',analytics:'Analytics'} as Record<string,string>)[this.section] ?? 'Workspace';}
 get intro(){return ({suppliers:'A structured directory for supplier relationships and purchasing preparation.',orders:'Understand how your team prepares, authorizes and receives supplier purchases.',analytics:'Understand procurement and inventory reports while company figures stay protected.'} as Record<string,string>)[this.section] ?? '';}
}
