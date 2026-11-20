import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccessPrompt } from './access-prompt';
import { UiLanguage } from '../core/ui-language';
@Component({selector:'app-section-preview',imports:[RouterLink,AccessPrompt],template:`
<section class="preview-hero"><p class="eyebrow">Jedel.Group ERP</p><h1>{{ text(title) }}</h1><p class="subtitle">{{ text(intro) }}</p></section>
@switch(section) {
 @case('suppliers') {
  <div class="cards"><article class="panel"><h2>{{ text('Build reliable supplier records') }}</h2><p>{{ text('Authorized teams maintain validated supplier identities and contact details in one directory.') }}</p></article><article class="panel"><h2>{{ text('Prepare procurement') }}</h2><p>{{ text('Connect a supplier to a Pending purchase order and select products from the catalog.') }}</p></article><article class="panel"><h2>{{ text('Keep contacts private') }}</h2><p>{{ text('Supplier identities and contact records have not been approved for public publication. Emails, phone numbers and addresses are visible only in the authorized workspace.') }}</p></article></div>
  <section class="panel"><h2>{{ text('Supplier management workflow') }}</h2><ol><li>{{ text('Check the directory before adding a supplier.') }}</li><li>{{ text('Validate the name and unique email; add optional phone and address details.') }}</li><li>{{ text('Prepare a procurement order using the verified supplier record.') }}</li><li>{{ text('Preserve relationships: referenced suppliers cannot be removed.') }}</li></ol><p>{{ text('This preview does not list actual suppliers, contact details, contracts or purchase pricing.') }}</p><a routerLink="/products">{{ text('Browse the public product catalog') }}</a></section>
 }
 @case('orders') {
  <section class="panel"><h2>{{ text('Procurement, from preparation to receipt') }}</h2><p>{{ text('These are company purchases from suppliers, not customer sales orders or checkout.') }}</p><ol class="workflow"><li><strong>{{ text('Pending') }}</strong><p>{{ text('An authorized employee selects a supplier, products, positive quantities and delivery dates. Only Pending orders can be amended.') }}</p></li><li><strong>{{ text('Approved') }}</strong><p>{{ text('An authorized manager approves the order. Approval does not receive goods or change stock.') }}</p></li><li><strong>{{ text('Delivered') }}</strong><p>{{ text('A manager confirms full receipt. Stock and final status are committed together exactly once.') }}</p></li><li><strong>{{ text('Cancelled') }}</strong><p>{{ text('Eligible Pending or Approved orders can be cancelled without changing inventory.') }}</p></li></ol></section>
  <div class="cards"><article class="panel"><h2>{{ text('Captured prices') }}</h2><p>{{ text('Order lines capture the agreed purchasing price. Catalog price changes do not rewrite that snapshot.') }}</p></article><article class="panel"><h2>{{ text('Protected inventory') }}</h2><p>{{ text('Delivery uses atomic transactions and row locks. Repeated delivery is rejected; a failure rolls back receipt changes.') }}</p></article><article class="panel"><h2>{{ text('Final states stay final') }}</h2><p>{{ text('Delivered and Cancelled orders cannot be reopened or casually edited. No arbitrary stock control is exposed.') }}</p></article></div>
  <p class="hint">{{ text('You can learn the workflow here without access to company orders. No live order numbers, suppliers, quantities or costs are shown.') }}</p>
 }
 @case('analytics') {
  <div class="cards"><article class="panel"><h2>{{ text('Purchasing commitments') }}</h2><p>{{ text('Non-cancelled Pending, Approved and Delivered orders contribute captured quantity × unit price. These values describe procurement commitments, not payments.') }}</p></article><article class="panel"><h2>{{ text('Supplier spending report') }}</h2><p>{{ text('Compare authorized purchasing commitments grouped by supplier. Cancelled orders are excluded.') }}</p></article><article class="panel"><h2>{{ text('Receipt value') }}</h2><p>{{ text('Delivered-order value reflects confirmed full receipts. The system does not maintain a payment ledger.') }}</p></article><article class="panel"><h2>{{ text('Order status distribution') }}</h2><p>{{ text('Review counts across Pending, Approved, Delivered and Cancelled workflow states.') }}</p></article><article class="panel"><h2>{{ text('Inventory overview') }}</h2><p>{{ text('Authorized users see current units and products at or below a configured low-stock threshold.') }}</p></article><article class="panel"><h2>{{ text('Dated order activity') }}</h2><p>{{ text('When enough dated records exist, authorized users can compare monthly order activity. Order dates are not receipt or payment dates.') }}</p></article></div>
  <section class="panel"><h2>{{ text('Report definitions before figures') }}</h2><p>{{ text('No financial aggregates, supplier rankings, order counts or inventory values have been approved for public release. This is an explanation of available reports, with no fabricated chart or sample financial value.') }}</p><a routerLink="/orders">{{ text('Understand the purchasing workflow') }}</a></section>
 }
}
<app-access-prompt [section]="section" />
`,styles:[`
  :host { display: grid; gap: var(--section-gap); }
  .preview-hero { max-width: 800px; }
  .subtitle, :host > .hint { margin-bottom: 0; }
  .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .workflow {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
    gap: 16px 28px;
    margin: 0;
    padding-inline-start: 24px;
  }
  .workflow p { margin: 6px 0 0; font-size: 14px; color: var(--muted); }
  @media (max-width: 900px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) { .cards { grid-template-columns: minmax(0, 1fr); } }
`]})
export class SectionPreview {
 readonly text = inject(UiLanguage).text;
 @Input() section='';
 get title(){return ({suppliers:'Suppliers',orders:'Purchase orders',analytics:'Analytics'} as Record<string,string>)[this.section] ?? 'Workspace';}
 get intro(){return ({suppliers:'A structured directory for supplier relationships and purchasing preparation.',orders:'Understand how your team prepares, authorizes and receives supplier purchases.',analytics:'Understand procurement and inventory reports while company figures stay protected.'} as Record<string,string>)[this.section] ?? '';}
}
