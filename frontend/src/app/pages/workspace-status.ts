import { Component, inject } from '@angular/core';
import { Store } from '../store';
import { UiLanguage } from '../core/ui-language';
@Component({selector:'app-workspace-status',styles:[`:host{display:contents}`],template:`@if(data.loading()) {<p class="note" role="status">{{ text('Loading workspace...') }}</p>} @else if(data.error()) {<section class="panel error" role="alert"><p>{{ text(data.error()) }}</p><button class="secondary" [disabled]="data.busy()" (click)="retry()">{{ text('Retry workspace') }}</button></section>}`})
export class WorkspaceStatus {
 readonly text = inject(UiLanguage).text;
 readonly data=inject(Store);
 async retry(){try{await this.data.refresh();}catch{/* The shared workspace retains its actionable error. */}}
}
