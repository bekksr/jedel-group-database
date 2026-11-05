import { TestBed } from '@angular/core/testing';
import { DataState } from './data-state';

describe('Shared data states', () => {
  it('renders loading, error, and empty states with accessible feedback', async () => {
    await TestBed.configureTestingModule({ imports: [DataState] }).compileComponents();
    const fixture = TestBed.createComponent(DataState);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Loading workspace',
    );
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('error', 'Connection failed');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Connection failed',
    );
    fixture.componentRef.setInput('error', '');
    fixture.componentRef.setInput('empty', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No results found');
  });
});
