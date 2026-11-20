import { Component, Input, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { UiLanguage } from '../core/ui-language';

// Display policy only: calculations and stored/API monetary values are untouched.
export const MONEY_DIGITS = '1.2-2';
export const COUNT_DIGITS = '1.0-0';

@Component({selector:'app-stat-card',imports:[DecimalPipe],styleUrl:'./stat-card.scss',template:`
<article class="stat-card" [attr.aria-label]="text(label)" [attr.aria-busy]="loading">
  @if(loading) {
    <div class="stat-metric"><strong class="stat-value"><span class="sr-only">{{ text('Loading') }}</span><span class="stat-skeleton" aria-hidden="true"></span></strong></div>
  } @else if(validValue !== null) {
    <div class="stat-metric"><strong class="stat-value">{{validValue | number:digits}}</strong>@if(unit) {<span class="stat-unit">{{ text(unit) }}</span>}</div>
  } @else {<div class="stat-metric"><strong class="stat-value stat-unavailable">{{ text('Unavailable') }}</strong></div>}
  <span class="stat-label">{{ text(label) }}</span>
  @if(description) {<p class="stat-description">{{ text(description) }}</p>}
</article>`})
export class StatCard {
  readonly text = inject(UiLanguage).text;
  @Input({required:true}) label='';
  @Input() value: number | null | undefined = null;
  @Input() format: 'count' | 'money' = 'count';
  @Input() unit='';
  @Input() description='';
  @Input() loading=false;
  get validValue(): number | null {return typeof this.value==='number' && Number.isFinite(this.value) ? this.value : null;}
  get digits() {return this.format==='money' ? MONEY_DIGITS : COUNT_DIGITS;}
}
