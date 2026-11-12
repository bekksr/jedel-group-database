import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PublicCatalogPage } from './public-catalog';
import { Auth } from '../auth';
import { beforeEach, afterEach, it, expect } from 'vitest';
let http: HttpTestingController;
beforeEach(() => {TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([])]}); http=TestBed.inject(HttpTestingController);});
afterEach(() => http.verify());
function initial() {
  const fixture=TestBed.createComponent(PublicCatalogPage);
  const request=http.expectOne(request => request.url === '/api/catalog/products/');
  http.expectOne('/api/catalog/categories/').flush({results:['Hardware','Office']});
  return {fixture,request};
}
it('renders Basic User safe products with category filters and no confidential fields or edit controls',async()=>{
  TestBed.inject(Auth).user.set({username:'basic',name:'Basic',email:'b@example.test',role:'Basic User',capabilities:{read:false}});
  const {fixture,request}=initial();
  request.flush({count:1,next:null,previous:null,results:[{product_id:7,product_name:'Safe product',category:'Hardware'}]});
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Safe product');
  expect(fixture.nativeElement.querySelector('select').textContent).toContain('Office');
  expect(fixture.nativeElement.textContent).not.toContain('Warehouse stock');
  expect(fixture.nativeElement.textContent).not.toContain('Unit price');
  expect(fixture.nativeElement.querySelectorAll('form').length).toBe(0);
  expect(fixture.nativeElement.textContent).not.toContain('Access denied');
  fixture.componentInstance.setCategory('Office');
  const filtered=http.expectOne(request => request.url === '/api/catalog/products/' && request.params.get('category') === 'Office');
  filtered.flush({count:0,next:null,previous:null,results:[]}); await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('No products match');
});
it('sends search only to the safe endpoint and resets pagination',async()=>{
  const {fixture,request}=initial(); request.flush({count:0,next:null,previous:null,results:[]});
  fixture.componentInstance.setSearch('Office');
  await new Promise(resolve=>setTimeout(resolve,300));
  const search=http.expectOne(request=>request.url==='/api/catalog/products/' && request.params.get('search')==='Office');
  expect(search.request.params.get('page')).toBe('1'); search.flush({count:0,next:null,previous:null,results:[]});
});
it('shows real loading/failure/retry states without mock data',async()=>{
  const {fixture,request}=initial(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Loading products');
  request.flush({}, {status:503,statusText:'Unavailable'}); await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy(); expect(fixture.componentInstance.products()).toEqual([]);
  fixture.componentInstance.refresh(); http.expectOne(request=>request.url==='/api/catalog/products/').flush({count:0,next:null,previous:null,results:[]});
  await fixture.whenStable(); expect(fixture.nativeElement.textContent).toContain('No products match');
});
it('cancels stale filter requests and uses safe relative pagination instead of following next URLs',async()=>{
  const {fixture,request}=initial();
  fixture.componentInstance.setCategory('Hardware'); expect(request.cancelled).toBe(true);
  http.expectOne(request=>request.url==='/api/catalog/products/').flush({count:30,next:'https://untrusted.example/page2',previous:null,results:[]});
  fixture.componentInstance.changePage(1);
  const next=http.expectOne(request=>request.url==='/api/catalog/products/' && request.params.get('page')==='2');
  next.flush({count:30,next:null,previous:'ignored',results:[]});
});
