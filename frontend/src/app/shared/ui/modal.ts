import { Icon } from './icon';
import {
  AfterViewInit,
  OnDestroy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
let nextDialogId = 0;
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [Icon],
  template: ` <dialog
    #dialog
    [class.wide]="wide()"
    [attr.aria-labelledby]="titleId"
    (cancel)="cancel($event)"
  >
    <header class="modal-header">
      <div>
        <p class="eyebrow">Jedel.Group workspace</p>
        <h2 [id]="titleId">{{ title() }}</h2>
      </div>
      <button
        type="button"
        class="icon-button"
        aria-label="Close dialog"
        [disabled]="busy()"
        (click)="dismiss.emit()"
      >
        <app-icon name="close" />
      </button>
    </header>
    <div class="modal-body"><ng-content /></div>
  </dialog>`,
})
export class Modal implements AfterViewInit, OnDestroy {
  private returnFocus: HTMLElement | null = null;
  readonly busy = input(false);
  readonly titleId = `erp-dialog-${++nextDialogId}`;
  readonly title = input.required<string>();
  readonly wide = input(false);
  readonly dismiss = output<void>();
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  ngAfterViewInit(): void {
    this.returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog().nativeElement.showModal();
  }
  ngOnDestroy(): void {
    const target = this.returnFocus;
    queueMicrotask(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
    });
  }
  cancel(event: Event): void {
    event.preventDefault();
    if (!this.busy()) this.dismiss.emit();
  }
}
