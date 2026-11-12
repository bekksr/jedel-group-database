import { Component, inject } from '@angular/core';
import { Store } from '../store';
@Component({selector:'app-workspace-status',template:`@if(data.loading()) {<p class="note" role="status">Loading company workspace...</p>} @else if(data.error()) {<section class="panel error" role="alert"><p>{{data.error()}}</p><button class="secondary" [disabled]="data.busy()" (click)="retry()">Retry workspace</button></section>}`})
export class WorkspaceStatus {
 readonly data=inject(Store);
 async retry(){try{await this.data.refresh();}catch{/* The shared workspace retains its actionable error. */}}
}
