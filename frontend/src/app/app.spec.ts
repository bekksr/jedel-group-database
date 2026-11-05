import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { ERP_DATA } from './core/data/models';
import { DemoDataService } from './core/data/demo-data.service';

describe('Application shell', () => {
  it('exposes all six workspace sections and explicit demo disclosure', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: ERP_DATA, useClass: DemoDataService }],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const links = fixture.nativeElement.querySelectorAll('nav a') as NodeListOf<HTMLAnchorElement>;
    expect(Array.from(links, (link) => link.getAttribute('href'))).toEqual([
      '/dashboard',
      '/suppliers',
      '/products',
      '/purchase-orders',
      '/analytics',
      '/settings',
    ]);
    expect(fixture.nativeElement.textContent).toContain('DEMO MODE');
    expect(fixture.nativeElement.textContent).toContain('No database writes.');
  });
  it('opens mobile navigation and closes it with Escape while returning focus', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: ERP_DATA, useClass: DemoDataService }],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const toggle = fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement;
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });
});
