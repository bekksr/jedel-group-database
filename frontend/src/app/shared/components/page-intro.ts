import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-intro',
  standalone: true,
  template: `
    <header class="page-intro">
      <p class="eyebrow">{{ section() }}</p>
      <h1>{{ heading() }}</h1>
      <p class="description">{{ description() }}</p>
    </header>
    <section class="empty-state" aria-label="Feature availability">
      <span class="status">Workspace foundation</span>
      <h2>Ready for the next step</h2>
      <p>
        This section is prepared for development. Purchasing features will be added in upcoming
        releases.
      </p>
    </section>
  `,
  styles: `
    .eyebrow {
      color: #256b57;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    h1 {
      font-size: clamp(1.8rem, 4vw, 2.7rem);
      line-height: 1.15;
      max-width: 22ch;
      margin: 0.75rem 0 1rem;
    }
    .description {
      color: #52616d;
      max-width: 62ch;
      line-height: 1.7;
    }
    .empty-state {
      margin-top: 2.5rem;
      padding: clamp(1.25rem, 4vw, 2.5rem);
      background: white;
      border: 1px solid #dce5e2;
      border-radius: 1rem;
    }
    .status {
      color: #256b57;
      background: #e9f3ee;
      border-radius: 2rem;
      padding: 0.4rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    h2 {
      margin-top: 1.5rem;
      font-size: 1.2rem;
    }
    .empty-state p {
      color: #52616d;
      line-height: 1.7;
      max-width: 60ch;
    }
  `,
})
export class PageIntro {
  readonly section = input.required<string>();
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
}
