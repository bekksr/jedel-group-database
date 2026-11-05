import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { useMetrics } from '../../core/data/metrics';
import { KztPipe } from '../../shared/pipes/kzt.pipe';
import { Icon } from '../../shared/ui/icon';
import { SpendingChart } from '../../shared/ui/spending-chart';
import { StatusChart } from '../../shared/ui/status-chart';
import { DataState } from '../../shared/ui/data-state';
@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [RouterLink, KztPipe, Icon, SpendingChart, StatusChart, DataState],
  templateUrl: './analytics.page.html',
})
export class AnalyticsPage {
  readonly metrics = useMetrics('analytics');
  readonly data = this.metrics.data;
}
