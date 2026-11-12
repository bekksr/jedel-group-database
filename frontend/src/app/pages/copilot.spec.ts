import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { CopilotPage } from './copilot';
import { Auth } from '../auth';
const basic = {username:'basic',name:'Basic Member',email:'basic@example.test',role:'Basic User',capabilities:{read:false}};
const publicCaps = {product_search:true,offer_comparison:false,inventory:false,order_draft:false,order_status:false,chat_configured:false,chat_scope:'Public catalog only'};
const product = {product_id:1,product_name:'Real fixture laptop',category:'Electronics'};
let http: HttpTestingController;
beforeEach(() => {TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([])]}); http=TestBed.inject(HttpTestingController);});
afterEach(() => http.verify());
async function setup(authorized=false) {
  TestBed.inject(Auth).user.set(basic);
  const fixture=TestBed.createComponent(CopilotPage);fixture.detectChanges();
  http.expectOne('/api/ai/capabilities/').flush({...publicCaps,offer_comparison:authorized,inventory:authorized,order_draft:authorized,order_status:authorized});
  await fixture.whenStable();
  if(authorized) {http.expectOne('/api/ai/suppliers/').flush({results:[{supplier_id:2,supplier_name:'Authorized supplier'}]});await fixture.whenStable();}
  return fixture;
}
async function csrf() {http.expectOne('/api/auth/csrf/').flush({});await new Promise(resolve=>setTimeout(resolve,0));}
it('renders useful public tools without provider or private data requests',async()=>{
  const fixture=await setup();const text=fixture.nativeElement.textContent;
  expect(text).toContain('AI Procurement Copilot');expect(text).toContain('AI chat is not configured');
  expect(text).toContain('Search the product catalog');expect(text).not.toContain('Best offer finder');expect(text).not.toContain('Inventory assistant');
  http.expectNone('/api/ai/suppliers/');
});
it('searches using CSRF and shows grounded product cards and loading state',async()=>{
  const fixture=await setup();fixture.componentInstance.query='laptop';
  TestBed.inject(Auth).restoring.set(true);fixture.detectChanges();expect(fixture.nativeElement.querySelector('form button').disabled).toBe(true);
  TestBed.inject(Auth).restoring.set(false);fixture.detectChanges();expect(fixture.nativeElement.querySelector('form button').disabled).toBe(false);
  const action=fixture.componentInstance.search();fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Working');
  await csrf();const request=http.expectOne('/api/ai/products/search/');expect(request.request.body.query).toBe('laptop');
  request.flush({results:[product],truncated:false,source:'PostgreSQL public-safe catalog',filters:{query:'laptop',category:'',match:'partial'}});
  await action;await fixture.whenStable();expect(fixture.nativeElement.textContent).toContain(product.product_name);expect(fixture.nativeElement.textContent).toContain('Product #1');
});
it('shows an honest empty state and an API failure with retry',async()=>{
  const fixture=await setup();let action=fixture.componentInstance.search();await csrf();
  http.expectOne('/api/ai/products/search/').flush({results:[],truncated:false,source:'PostgreSQL',filters:{query:'',category:'',match:'partial'}});await action;await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('No products match');
  action=fixture.componentInstance.search();await csrf();http.expectOne('/api/ai/products/search/').flush({detail:'Unavailable'},{status:503,statusText:'Unavailable'});await action;await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();expect(fixture.nativeElement.textContent).toContain('Retry last request');
});
it('shows only permitted private tools and deterministic quotation calculations',async()=>{
  const fixture=await setup(true);fixture.componentInstance.choose(product);fixture.componentInstance.csv='approved csv';fixture.componentInstance.approved=true;fixture.componentInstance.equivalent=true;
  const action=fixture.componentInstance.compare();await csrf();const request=http.expectOne('/api/ai/offers/compare/');expect(request.request.body.product_id).toBe(1);
  request.flush({results:[{reference:'quote-1',supplier_id:2,supplier_name:'Authorized supplier',rank:1,quantity:10,unit_price:'10.25',subtotal:'102.50',delivery_cost:'5.00',total:'107.50',effective_unit_cost:'10.7500',currency:'KZT',unit:'unit',source:'Approved quote',quoted_at:'2026-11-01T00:00:00Z',delivery_days:2,available_quantity:50,min_order_quantity:1,specifications:'Reviewed specification',eligible:true,warnings:[]}],best_reference:'quote-1',warnings:[]});
  await action;await fixture.whenStable();expect(fixture.nativeElement.textContent).toContain('107.50');expect(fixture.nativeElement.textContent).toContain('Approved quote');expect(fixture.nativeElement.textContent).toContain('Purchase order assistant');
});
it('clears private results on logout and ignores late private responses',async()=>{
  const fixture=await setup(true);const action=fixture.componentInstance.loadInventory();await csrf();const pending=http.expectOne('/api/ai/inventory/');
  TestBed.inject(Auth).user.set(null);fixture.detectChanges();http.expectOne('/api/ai/capabilities/').flush(publicCaps);await fixture.whenStable();
  pending.flush({results:[{...product,stock_quantity:999}],threshold:20,threshold_basis:'request',guidance:'private',truncated:false});await action;await fixture.whenStable();
  expect(fixture.componentInstance.inventory()).toBeNull();expect(fixture.nativeElement.textContent).not.toContain('999');expect(fixture.nativeElement.textContent).not.toContain('Best offer finder');
});
it('chat uses explicit consent and displays backend-grounded messages',async()=>{
  const fixture=await setup();fixture.componentInstance.caps.set({...publicCaps,chat_configured:true});fixture.componentInstance.message='Find laptops';fixture.componentInstance.consent=true;
  const action=fixture.componentInstance.chat();await csrf();const request=http.expectOne('/api/ai/chat/');expect(request.request.body.consent_to_provider).toBe(true);
  request.flush({results:[product],source:'PostgreSQL',kind:'ai_interpreted_catalog_search',truncated:false,filters:{query:'laptop',category:'',match:'partial'},message:'Found 1 matching catalog records.'});await action;await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Found 1 matching catalog records.');expect(fixture.nativeElement.textContent).toContain('You:');
});
it('renders a review-only draft and inventory with explicit threshold',async()=>{
  const fixture=await setup(true);fixture.componentInstance.choose(product);fixture.componentInstance.supplierId=2;
  let action=fixture.componentInstance.prepare();await csrf();http.expectOne('/api/ai/orders/draft/').flush({draft_only:true,persisted:false,supplier:{supplier_id:2,supplier_name:'Authorized supplier'},items:[{product_id:1,product_name:product.product_name,quantity:1,unit_price:'10.25',subtotal:'10.25'}],currency:'KZT',source:'Catalog price',warnings:['No order was changed.']});await action;await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Draft proposal — not saved');
  action=fixture.componentInstance.loadInventory();await csrf();http.expectOne('/api/ai/inventory/').flush({results:[{...product,stock_quantity:5}],threshold:20,threshold_basis:'request',guidance:'Review with team',truncated:false});await action;await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Threshold 20');expect(fixture.nativeElement.textContent).toContain('5 units');
});
it('supports authorized local inventory questions while optional AI is disabled',async()=>{
  const fixture=await setup(true);fixture.componentInstance.message='Which products have low stock?';
  expect(fixture.componentInstance.canSend()).toBe(true);
  const action=fixture.componentInstance.chat();await csrf();
  http.expectOne('/api/ai/chat/').flush({kind:'inventory',message:'Inventory read from PostgreSQL.',inventory:{results:[{...product,stock_quantity:5}],threshold:20,threshold_basis:'request',guidance:'Review with team',truncated:false}});
  await action;await fixture.whenStable();expect(fixture.nativeElement.textContent).toContain('Inventory read from PostgreSQL.');expect(fixture.nativeElement.textContent).toContain('5 units');
});
it('retries capability and supplier initialization after an unavailable backend',async()=>{
  TestBed.inject(Auth).user.set(basic);const fixture=TestBed.createComponent(CopilotPage);fixture.detectChanges();
  http.expectOne('/api/ai/capabilities/').flush({detail:'Database service unavailable.'},{status:503,statusText:'Unavailable'});await new Promise(resolve=>setTimeout(resolve,0));await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Database service unavailable.');
  const action=fixture.componentInstance.retry();
  http.expectOne('/api/ai/capabilities/').flush({...publicCaps,order_draft:true});await new Promise(resolve=>setTimeout(resolve,0));
  http.expectOne('/api/ai/suppliers/').flush({results:[{supplier_id:2,supplier_name:'Authorized supplier'}]});await action;await fixture.whenStable();
  expect(fixture.componentInstance.suppliers().length).toBe(1);expect(fixture.componentInstance.error()).toBe('');
});
it('explains disabled external chat and distinguishes local query permissions',async()=>{
  const fixture=await setup();const page=fixture.componentInstance;
  page.message='Find Laptop Dell';expect(page.canSend()).toBe(false);expect(page.sendHint()).toContain('not configured');
  page.message='Which products have low stock?';expect(page.canSend()).toBe(false);expect(page.sendHint()).toContain('assigned role');
  page.caps.set({...publicCaps,inventory:true});expect(page.canSend()).toBe(true);expect(page.sendHint()).toContain('No OpenAI key');
  page.message='What is inventory?';expect(page.canSend()).toBe(false);
  page.message='Show inventory levels for category Electronics.';expect(page.canSend()).toBe(true);
  page.message='Prepare a purchase order for 20 units of product 1 from supplier 1.';expect(page.canSend()).toBe(false);
  page.caps.set({...publicCaps,order_draft:true});expect(page.canSend()).toBe(true);
});
it('local suggestion enables a real Ask button without external consent',async()=>{
  const fixture=await setup(true);
  const button=[...fixture.nativeElement.querySelectorAll('button')].find((element: Element)=>element.textContent?.includes('Use local low-stock question')) as HTMLButtonElement;
  button.click();await fixture.whenStable();
  const ask=[...fixture.nativeElement.querySelectorAll('button')].find((element: Element)=>element.textContent==='Ask Copilot') as HTMLButtonElement;
  expect(ask.disabled).toBe(false);expect(fixture.componentInstance.consent).toBe(false);
  expect(fixture.nativeElement.textContent).toContain('this question runs locally in Django');
});
