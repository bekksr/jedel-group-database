import { Component, computed, input } from '@angular/core';
import { OrderStatus } from '../../core/data/models';
@Component({
  selector: 'app-status-chart',
  standalone: true,
  template: ` <div class="status-chart">
    <div class="donut" [style.background]="gradient()" role="img" [attr.aria-label]="description()">
      <div>
        <strong>{{ total() }}</strong
        ><span>Total orders</span>
      </div>
    </div>
    <div class="chart-legend">
      @for (row of rows(); track row.status) {
        <div>
          <span class="legend-dot" [attr.data-status]="row.status"></span
          ><span>{{ row.status }}</span
          ><strong>{{ row.count }}</strong
          ><small>{{ total() ? ((row.count / total()) * 100).toFixed(0) : 0 }}%</small>
        </div>
      }
    </div>
  </div>`,
})
export class StatusChart {
  readonly rows = input.required<readonly { status: OrderStatus; count: number }[]>();
  readonly total = computed(() => this.rows().reduce((sum, r) => sum + r.count, 0));
  readonly description = computed(() =>
    this.rows()
      .map((r) => `${r.status}: ${r.count}`)
      .join(', '),
  );
  readonly gradient = computed(() => {
    if (!this.total()) return '#e8edf5';
    const colors: Record<OrderStatus, string> = {
      Pending: '#eaa643',
      Approved: '#4879ed',
      Delivered: '#35a682',
      Cancelled: '#d76672',
    };
    let offset = 0;
    return (
      'conic-gradient(' +
      this.rows()
        .map((r) => {
          const start = offset;
          offset += (r.count / this.total()) * 100;
          return `${colors[r.status]} ${start}% ${offset}%`;
        })
        .join(', ') +
      ')'
    );
  });
}
