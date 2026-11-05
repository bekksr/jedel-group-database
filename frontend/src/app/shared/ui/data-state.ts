import { Component, input } from '@angular/core';
@Component({
  selector: 'app-data-state',
  standalone: true,
  template: `
    @if (loading()) {
      <div class="data-state" role="status">
        <span class="loader"></span>
        <h3>Loading workspace</h3>
        <p>Retrieving your purchasing records?</p>
      </div>
    } @else if (error()) {
      <div class="data-state error-state" role="alert">
        <h3>Unable to load data</h3>
        <p>{{ error() }}</p>
      </div>
    } @else if (empty()) {
      <div class="data-state">
        <span class="empty-symbol">?</span>
        <h3>{{ title() }}</h3>
        <p>{{ description() }}</p>
      </div>
    }
  `,
})
export class DataState {
  readonly loading = input(false);
  readonly error = input('');
  readonly empty = input(false);
  readonly title = input('No results found');
  readonly description = input('Try another search or adjust your filters.');
}
