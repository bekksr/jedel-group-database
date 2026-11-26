import { Component, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Page } from '../core/data/api-contracts';
import { apiError } from '../core/data/api-errors';
import { UiLanguage } from '../core/ui-language';
import { Auth } from '../auth';

export interface PublicSupplier { supplier_id: number; supplier_name: string; }
export interface PublicOrder {
  order_id: number; supplier_name: string; order_date: string;
  expected_delivery_date: string | null; status: string;
  items: { product_id: number; product_name: string; quantity: number }[];
}

@Injectable({providedIn: 'root'})
class PublicRecordsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl.replace(/\/$/, '') + '/catalog/';
  suppliers(page: number) { return firstValueFrom(this.http.get<Page<PublicSupplier>>(this.base + 'suppliers/', {params: new HttpParams().set('page', page)})); }
  orders(page: number) { return firstValueFrom(this.http.get<Page<PublicOrder>>(this.base + 'orders/', {params: new HttpParams().set('page', page)})); }
}

@Component({selector: 'app-public-suppliers', imports: [RouterLink], template: `
<section class="preview-hero"><p class="eyebrow">Jedel.Group</p><h1>{{ text('Suppliers') }}</h1><p class="subtitle">{{ text('Browse the supplier directory. Contact details are available after sign-in.') }}</p></section>
<p class="hint">{{ text('Public supplier view shows names only. Email, phone and address remain private.') }}</p>
@if(!auth.user()) {<p><a class="button secondary" routerLink="/auth" [queryParams]="{mode:'register'}">{{ text('Create an account to prepare orders') }}</a></p>}
@if(loading()) {<p role="status">{{ text('Loading suppliers...') }}</p>}
@else if(error()) {<p class="error" role="alert">{{ text(error()) }} <button class="secondary" (click)="load()">{{ text('Retry') }}</button></p>}
@else {<p role="status">{{ text('{count} suppliers found.', {count: count()}) }}</p><div class="cards">@for(supplier of rows(); track supplier.supplier_id) {<article class="panel"><p class="eyebrow">{{ text('Supplier') }} #{{supplier.supplier_id}}</p><h2>{{supplier.supplier_name}}</h2></article>} @empty {<p class="panel empty-state">{{ text('No suppliers are available.') }}</p>}</div>
<div class="actions"><button class="secondary" [disabled]="page() <= 1" (click)="change(-1)">{{text('Previous')}}</button><span>{{text('Page {page}',{page:page()})}}</span><button class="secondary" [disabled]="!next()" (click)="change(1)">{{text('Next')}}</button></div>}
`})
export class PublicSuppliersPage {
 readonly text=inject(UiLanguage).text; readonly auth=inject(Auth); private readonly service=inject(PublicRecordsService);
 readonly rows=signal<PublicSupplier[]>([]); readonly loading=signal(true); readonly error=signal(''); readonly count=signal(0); readonly page=signal(1); readonly next=signal(false);
 constructor(){void this.load();}
 async load(){this.loading.set(true);this.error.set('');try{const result=await this.service.suppliers(this.page());this.rows.set(result.results);this.count.set(result.count);this.next.set(!!result.next);}catch(e){this.error.set(apiError(e));}finally{this.loading.set(false);}}
 change(delta:number){this.page.update(page=>page+delta);void this.load();}
}

@Component({selector: 'app-public-orders', imports: [RouterLink], template: `
<section class="preview-hero"><p class="eyebrow">Jedel.Group</p><h1>{{ text('Purchase orders') }}</h1><p class="subtitle">{{ text('Browse read-only order summaries. Creating or changing orders requires an account.') }}</p></section>
<p class="hint">{{ text('Public order view shows supplier, dates, status, products and quantities. Prices and inventory are private.') }}</p>
@if(!auth.user()) {<p><a class="button secondary" routerLink="/auth" [queryParams]="{mode:'register'}">{{ text('Create an account to prepare orders') }}</a></p>}
@if(loading()) {<p role="status">{{ text('Loading orders...') }}</p>}
@else if(error()) {<p class="error" role="alert">{{ text(error()) }} <button class="secondary" (click)="load()">{{ text('Retry') }}</button></p>}
@else {<p role="status">{{ text('{count} orders found.', {count: count()}) }}</p><div class="cards">@for(order of rows(); track order.order_id) {<article class="panel"><p class="eyebrow">{{text('Order')}} #{{order.order_id}} - {{text(order.status)}}</p><h2>{{order.supplier_name}}</h2><p>{{text('Order date')}}: {{order.order_date}}@if(order.expected_delivery_date){<span> - {{text('Expected delivery')}}: {{order.expected_delivery_date}}</span>}</p><ul>@for(item of order.items;track item.product_id){<li>{{item.product_name}} - {{item.quantity}} {{text('units')}}</li>}</ul></article>} @empty {<p class="panel empty-state">{{ text('No orders are available.') }}</p>}</div>
<div class="actions"><button class="secondary" [disabled]="page() <= 1" (click)="change(-1)">{{text('Previous')}}</button><span>{{text('Page {page}',{page:page()})}}</span><button class="secondary" [disabled]="!next()" (click)="change(1)">{{text('Next')}}</button></div>}
`})
export class PublicOrdersPage {
 readonly text=inject(UiLanguage).text; readonly auth=inject(Auth); private readonly service=inject(PublicRecordsService);
 readonly rows=signal<PublicOrder[]>([]); readonly loading=signal(true); readonly error=signal(''); readonly count=signal(0); readonly page=signal(1); readonly next=signal(false);
 constructor(){void this.load();}
 async load(){this.loading.set(true);this.error.set('');try{const result=await this.service.orders(this.page());this.rows.set(result.results);this.count.set(result.count);this.next.set(!!result.next);}catch(e){this.error.set(apiError(e));}finally{this.loading.set(false);}}
 change(delta:number){this.page.update(page=>page+delta);void this.load();}
}
