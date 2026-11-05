import { Component, computed, input } from '@angular/core';
import { Spending } from '../../core/data/models';
import { KztPipe } from '../pipes/kzt.pipe';
@Component({
  selector: 'app-spending-chart',
  standalone: true,
  imports: [KztPipe],
  template: ` <div
    class="bar-chart"
    role="list"
    aria-label="Supplier order value, excluding cancelled orders"
  >
    @for (row of rows(); track row.label) {
      <div class="bar-row" role="listitem">
        <div class="bar-caption">
          <span>{{ row.label }}</span
          ><strong>{{ row.value | kzt }}</strong>
        </div>
        <div class="bar-track">
          <div
            class="bar-fill"
            [style.width.%]="maximum() ? (row.value / maximum()) * 100 : 0"
          ></div>
        </div>
        <span class="chart-detail"
          >{{ row.orders }} {{ row.orders === 1 ? 'order' : 'orders' }}</span
        >
      </div>
    } @empty {
      <p class="muted">No supplier records available.</p>
    }
  </div>`,
})
export class SpendingChart {
  readonly rows = input.required<readonly Spending[]>();
  readonly maximum = computed(() => Math.max(0, ...this.rows().map((r) => r.value)));
}
