import { Component, Input, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Auth } from '../auth';
import { UiLanguage } from '../core/ui-language';
@Component({selector: 'app-access-prompt', imports: [RouterLink], template: `<aside class="panel access-panel" [attr.aria-label]="text('Workspace access')">
  @if(auth.user(); as user) {<h2>{{ text('Need workspace access?') }}</h2><p>{{ text('You are signed in as {role}. This page is available to browse; company records and actions require an assigned business role.', {role: text(user.role)}) }}</p><a class="button secondary" routerLink="/access" [queryParams]="{section: section}">{{ text('Request access') }}</a>}
  @else {<h2>{{ text('Open your team workspace') }}</h2><p>{{ text('Log in to use features permitted by your assigned role. New Basic User accounts can browse public content; registration does not grant purchasing access.') }}</p><a class="button" routerLink="/auth" [queryParams]="{mode: 'login', returnTo: '/' + section}">{{ text('Log in to workspace') }}</a>}
</aside>`, styles: [`:host{display:block}.access-panel{border-left:4px solid var(--accent)}`]})
export class AccessPrompt {
 readonly text = inject(UiLanguage).text;
 readonly auth = inject(Auth);
 @Input() section = '';
}
@Component({imports:[RouterLink], template:`<h1>{{ text('Request workspace access') }}</h1><section class="panel narrow"><p>{{ text('Purchasing access is assigned by an authorized Jedel.Group administrator. This page explains how to request it; it does not submit or approve a request automatically.') }}</p>
@if(auth.user(); as user) {<dl><dt>{{ text('Your account') }}</dt><dd>{{user.username}}</dd><dt>{{ text('Current role') }}</dt><dd>{{ text(user.role) }}</dd><dt>{{ text('Requested section') }}</dt><dd>{{ text(section) }}</dd></dl>}
<ol><li>{{ text('Contact your team administrator through your usual team channel.') }}</li><li>{{ text('Share your account username, the section you need and the business task you perform.') }}</li><li>{{ text('The administrator reviews the request and assigns the least-privileged appropriate role.') }}</li><li>{{ text('Refresh your session or log in again after the assignment.') }}</li></ol>
<p>{{ text('Purchasing Employee prepares orders and maintains catalogs; Purchasing Manager can approve and receive eligible orders; Analyst reads authorized reports. Staff and administrator rights require explicit approval.') }}</p><div class="actions"><a class="button secondary" routerLink="/">{{ text('Back to Home') }}</a><a class="button secondary" routerLink="/profile">{{ text('My account') }}</a></div></section>`})
export class AccessRequestPage {
 readonly text = inject(UiLanguage).text;
 readonly auth=inject(Auth);
 private readonly value=inject(ActivatedRoute).snapshot.queryParamMap.get('section');
 readonly section = ['Suppliers', 'Orders', 'Analytics', 'Products'].find(label => label.toLowerCase() === this.value) ?? 'Company workspace';
}
