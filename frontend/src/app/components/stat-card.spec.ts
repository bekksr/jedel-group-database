import { TestBed } from '@angular/core/testing';
import { it, expect } from 'vitest';
import { StatCard } from './stat-card';

it('renders metric value, label, currency and description as separate accessible elements',()=>{
  const fixture=TestBed.createComponent(StatCard);
  for(const [name,value] of Object.entries({label:'Purchasing commitments',value:2420000,format:'money',unit:'KZT',description:'Not payments'})) fixture.componentRef.setInput(name,value);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.stat-value').textContent).toBe('2,420,000.00');
  expect(fixture.nativeElement.querySelector('.stat-label').textContent).toBe('Purchasing commitments');
  expect(fixture.nativeElement.querySelector('.stat-unit').textContent).toBe('KZT');
  expect(fixture.nativeElement.querySelector('article').getAttribute('aria-label')).toBe('Purchasing commitments');
  expect(fixture.nativeElement.textContent).toContain('Not payments');
});
it('formats zero and negative KZT values without altering the input precision',()=>{
  const fixture=TestBed.createComponent(StatCard);fixture.componentRef.setInput('label','Receipt correction');fixture.componentRef.setInput('format','money');
  fixture.componentRef.setInput('value',0);fixture.detectChanges();expect(fixture.nativeElement.querySelector('.stat-value').textContent).toBe('0.00');
  fixture.componentRef.setInput('value',-1234567.891);fixture.detectChanges();expect(fixture.nativeElement.querySelector('.stat-value').textContent).toBe('-1,234,567.89');
  expect(fixture.componentInstance.value).toBe(-1234567.891);
});
it('groups counts and supports large values without abbreviation or truncation',()=>{
  const fixture=TestBed.createComponent(StatCard);fixture.componentRef.setInput('label','Inventory');fixture.componentRef.setInput('value',Number.MAX_SAFE_INTEGER);fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.stat-value').textContent).toBe('9,007,199,254,740,991');
});
it('renders unavailable values honestly instead of NaN, null, infinity or a fabricated zero',()=>{
  const fixture=TestBed.createComponent(StatCard);fixture.componentRef.setInput('label','Unavailable');fixture.componentRef.setInput('unit','KZT');
  for(const value of [null,undefined,NaN,Infinity,'12.50']) {
    fixture.componentRef.setInput('value',value);fixture.detectChanges();expect(fixture.nativeElement.querySelector('.stat-value').textContent).toBe('Unavailable');expect(fixture.nativeElement.querySelector('.stat-unit')).toBeNull();
  }
});
it('exposes loading state while hiding stale financial values',()=>{
  const fixture=TestBed.createComponent(StatCard);fixture.componentRef.setInput('label','Loading');fixture.componentRef.setInput('value',999);fixture.componentRef.setInput('loading',true);fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('article').getAttribute('aria-busy')).toBe('true');expect(fixture.nativeElement.textContent).toContain('Loading');expect(fixture.nativeElement.textContent).not.toContain('999');
});
