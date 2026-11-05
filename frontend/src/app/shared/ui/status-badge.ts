import { Component, input } from '@angular/core';
import { OrderStatus } from '../../core/data/models';
@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="status-badge" [attr.data-status]="status()"
    ><span class="status-dot"></span>{{ status() }}</span
  >`,
})
export class StatusBadge {
  readonly status = input.required<OrderStatus>();
}
