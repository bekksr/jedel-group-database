import { Component, computed, input, output } from '@angular/core';
@Component({
  selector: 'app-pagination',
  standalone: true,
  template: ` <div class="pagination">
    <span>{{ total() ? (page() - 1) * size() + 1 : 0 }}-{{ end() }} of {{ total() }} results</span>
    <div>
      <button
        type="button"
        class="button small secondary"
        [disabled]="page() <= 1"
        (click)="pageChange.emit(page() - 1)"
        aria-label="Previous page"
      >
        Previous</button
      ><span class="page-number">{{ page() }} / {{ pages() }}</span
      ><button
        type="button"
        class="button small secondary"
        [disabled]="page() >= pages()"
        (click)="pageChange.emit(page() + 1)"
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  </div>`,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly size = input(5);
  readonly total = input.required<number>();
  readonly pageChange = output<number>();
  readonly end = computed(() => Math.min(this.page() * this.size(), this.total()));
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
}
