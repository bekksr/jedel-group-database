import { Component, Input, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Auth } from '../auth';
@Component({selector: 'app-access-prompt', imports: [RouterLink], template: `<aside class="panel access-panel" aria-label="Workspace access">
  @if(auth.user(); as user) {<h2>Need workspace access?</h2><p>You are signed in as {{user.role}}. This page is available to browse; company records and actions require an assigned business role.</p><a class="button secondary" routerLink="/access" [queryParams]="{section: section}">Request access</a>}
  @else {<h2>Open your team workspace</h2><p>Log in to use features permitted by your assigned role. New Basic User accounts can browse public content; registration does not grant purchasing access.</p><a class="button" routerLink="/auth" [queryParams]="{mode: 'login', returnTo: '/' + section}">Log in to workspace</a>}
</aside>`, styles: [`.access-panel{border-left:4px solid var(--accent);margin-top:24px}.access-panel h2{margin-top:0}`]})
export class AccessPrompt {readonly auth = inject(Auth); @Input() section = '';}
@Component({imports:[RouterLink], template:`<h1>Request workspace access</h1><section class="panel narrow"><p>Purchasing access is assigned by an authorized Jedel.Group administrator. This page explains how to request it; it does not submit or approve a request automatically.</p>
@if(auth.user(); as user) {<dl><dt>Your account</dt><dd>{{user.username}}</dd><dt>Current role</dt><dd>{{user.role}}</dd><dt>Requested section</dt><dd>{{section}}</dd></dl>}
<ol><li>Contact your team administrator through your usual team channel.</li><li>Share your account username, the section you need and the business task you perform.</li><li>The administrator reviews the request and assigns the least-privileged appropriate role.</li><li>Refresh your session or log in again after the assignment.</li></ol>
<p>Purchasing Employee prepares orders and maintains catalogs; Purchasing Manager can approve and receive eligible orders; Analyst reads authorized reports. Staff and administrator rights require explicit approval.</p><a class="button secondary" routerLink="/">Back to Home</a> <a routerLink="/settings">My account</a></section>`})
export class AccessRequestPage {
 readonly auth=inject(Auth);
 private readonly value=inject(ActivatedRoute).snapshot.queryParamMap.get('section');
 readonly section=['suppliers','orders','analytics','products'].includes(this.value ?? '') ? this.value! : 'Company workspace';
}
