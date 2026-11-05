import { Component, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { useMetrics } from '../../core/data/metrics';
import { Icon } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';
import { KztPipe } from '../../shared/pipes/kzt.pipe';
import { SpendingChart } from '../../shared/ui/spending-chart';
import { StatusChart } from '../../shared/ui/status-chart';
import { DataState } from '../../shared/ui/data-state';
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    Icon,
    StatusBadge,
    KztPipe,
    SpendingChart,
    StatusChart,
    DataState,
  ],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  readonly metrics = useMetrics();
  readonly data = this.metrics.data;
  readonly recent = computed(() =>
    this.data.mode === 'api'
      ? (this.data.dashboard?.()?.recentOrders ?? [])
      : this.data
          .orders()
          .slice()
          .sort((a, b) => b.order_date.localeCompare(a.order_date) || b.order_id - a.order_id)
          .slice(0, 5),
  );
  supplierName(id: number): string {
    return (
      this.data.suppliers().find((s) => s.supplier_id === id)?.supplier_name ?? 'Unknown supplier'
    );
  }
}
