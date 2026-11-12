import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { routes } from './routes';
import { Auth, Account } from './auth';
import { ApiDataService } from './core/data/api-data.service';
import { OrdersPage } from './pages/orders';
import { beforeEach, afterEach, it, expect } from 'vitest';
let http: HttpTestingController;
const supplier={supplier_id:1,supplier_name:'Confidential supplier',email:'private@example.test',phone:'SECRET-PHONE',address:'Private office'};
const product={product_id:2,product_name:'Fixture product',category:'Hardware',unit_price:'42.50',stock_quantity:7};
const orders=[{order_id:11,supplier_id:1,supplier_name:supplier.supplier_name,order_date:'2026-10-01',expected_delivery_date:null,status:'Pending',total:'85.00',items:[{item_id:21,product_id:2,product_name:product.product_name,quantity:2,unit_price:'42.50',line_total:'85.00'}]}, {order_id:12,supplier_id:1,supplier_name:supplier.supplier_name,order_date:'2026-11-01',expected_delivery_date:null,status:'Delivered',total:'85.00',items:[{item_id:22,product_id:2,product_name:product.product_name,quantity:2,unit_price:'42.50',line_total:'85.00'}]}];
const page=(results:unknown[])=>({count:results.length,next:null,previous:null,results});
function account(role:string):Account {
 const read=!['Anonymous','Basic User','Security Administrator'].includes(role);
 return {username:'fixture',name:'Fixture',email:'fixture@example.test',role,capabilities:{read,manage_catalog:read && role!=='Analyst / Tester',create_orders:read && role!=='Analyst / Tester',transition_orders:['Purchasing Manager','System Administrator'].includes(role),delete_records:role==='System Administrator'}};
}
async function privateSnapshot(role='Purchasing Manager') {
 const user=account(role); TestBed.inject(Auth).user.set(user);
 const pending=TestBed.inject(ApiDataService).refresh();
 const status=[{status:'Pending',count:1},{status:'Delivered',count:1}];
 const spending=[{supplier_id:1,supplier_name:supplier.supplier_name,total:'170.00',order_count:2}];
 const caps=user.capabilities;
 const responses:Record<string,object>={
  '/api/access/':{role,can_write:!!caps.manage_catalog,capabilities:caps},
  '/api/suppliers/?page=1':page([supplier]),'/api/products/?page=1':page([product]),'/api/orders/?page=1':page(orders),
  '/api/dashboard/?low_stock_threshold=20':{currency:'KZT',total_suppliers:1,total_products:1,total_purchase_orders:2,total_purchasing_value:'170.00',delivered_order_value:'85.00',status_distribution:status,supplier_spending:spending,recent_orders:orders,stock_overview:{total_units:7,low_stock_threshold:20,low_stock_products:[product]}},
  '/api/analytics/supplier-spending/':{results:spending},'/api/analytics/order-status/':{results:status},
 };
 for(const [url,body] of Object.entries(responses)) http.expectOne(url).flush(body);
 await pending;
}
function publicCatalog() {
 http.expectOne(request=>request.url==='/api/catalog/products/').flush(page([{product_id:2,product_name:'Fixture product',category:'Hardware'}]));
 http.expectOne('/api/catalog/categories/').flush({results:['Hardware']});
}
beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter(routes)]});http=TestBed.inject(HttpTestingController);});
afterEach(()=>http.verify());
for(const role of ['Anonymous','Basic User','Purchasing Employee','Purchasing Manager','Analyst / Tester','System Administrator','Security Administrator']) {
 it(`opens all five sections safely for ${role}`,async()=>{
  // Deliberately leave a previous authorized snapshot cached to test template boundaries.
  const read=account(role).capabilities.read;
  await privateSnapshot(read ? role : 'Purchasing Manager');
  TestBed.inject(Auth).user.set(role==='Anonymous'?null:account(role));
  const harness=await RouterTestingHarness.create();
  for(const url of ['/','/products','/suppliers','/orders','/analytics']) {
   await harness.navigateByUrl(url);
   if(url==='/products' && !read) publicCatalog();
   harness.detectChanges();
   const text=harness.routeNativeElement!.textContent!;
   expect(harness.routeNativeElement!.querySelector('h1')).toBeTruthy();expect(text).not.toContain('Access denied.');
   if(!read) {
    for(const secret of ['private@example.test','Confidential supplier','SECRET-PHONE','42.50','170.00','85.00']) expect(text).not.toContain(secret);
    if(url==='/suppliers') expect(text).toContain('Supplier management workflow');
    if(url==='/orders') expect(text).toContain('not customer sales orders');
    if(url==='/analytics') expect(text).toContain('Report definitions before figures');
   } else {
    if(url==='/') expect(text).toContain('170.00');
    if(url==='/suppliers') expect(text).toContain('private@example.test');
    if(url==='/products') expect(text).toContain('42.50');
    if(url==='/analytics') {expect(text).toContain('170.00');expect(text).toContain('85.00');expect(text).toContain('2026-10');expect(text).toContain('not actual payments');}
    if(url==='/orders') {
     const component=harness.routeDebugElement!.query(By.directive(OrdersPage)).componentInstance as OrdersPage;
     component.selectedId.set(11);harness.detectChanges();
     const buttons=[...harness.routeNativeElement!.querySelectorAll('button')].map(button=>button.textContent?.trim());
     expect(buttons.includes('Mark Approved')).toBe(['Purchasing Manager','System Administrator'].includes(role));
    }
   }
  }
  http.expectNone(request=>request.url.startsWith('/api/'));
 });
}
it('offers Basic User access guidance without redirecting back to login or claiming a request was sent',async()=>{
 TestBed.inject(Auth).user.set(account('Basic User'));const harness=await RouterTestingHarness.create();await harness.navigateByUrl('/access?section=orders');
 expect(harness.routeNativeElement!.textContent).toContain('does not submit or approve a request automatically');
 expect(harness.routeNativeElement!.textContent).toContain('Basic User');expect(TestBed.inject(Router).url).toContain('/access');
 http.expectNone(request=>request.url.startsWith('/api/'));
});
it('shows one actionable backend-unavailable state on every business section and never fake empty metrics',async()=>{
 TestBed.inject(Auth).user.set(account('Purchasing Manager'));
 const harness=await RouterTestingHarness.create();
 for(const url of ['/','/products','/suppliers','/orders','/analytics']) {
  await harness.navigateByUrl(url);
  expect(harness.routeNativeElement!.querySelectorAll('[role=alert]').length).toBe(1);
  expect(harness.routeNativeElement!.textContent).toContain('Retry workspace');
  expect(harness.routeNativeElement!.querySelector('[aria-label="Purchasing metrics"]')).toBeNull();
 }
});
