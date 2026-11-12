import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

// Display policy only: calculations and stored/API monetary values are untouched.
export const MONEY_DIGITS = '1.2-2';
export const COUNT_DIGITS = '1.0-0';

@Component({selector:'app-stat-card',imports:[DecimalPipe],styleUrl:'./stat-card.scss',template:`
<article class="stat-card" [attr.aria-label]="label" [attr.aria-busy]="loading">
  @if(loading) {
    <div class="stat-metric"><strong class="stat-value"><span class="sr-only">Loading</span><span class="stat-skeleton" aria-hidden="true"></span></strong></div>
  } @else if(validValue !== null) {
    <div class="stat-metric"><strong class="stat-value">{{validValue | number:digits}}</strong>@if(unit) {<span class="stat-unit">{{unit}}</span>}</div>
  } @else {<div class="stat-metric"><strong class="stat-value stat-unavailable">Unavailable</strong></div>}
  <span class="stat-label">{{label}}</span>
  @if(description) {<p class="stat-description">{{description}}</p>}
</article>`})
export class StatCard {
  @Input({required:true}) label='';
  @Input() value: number | null | undefined = null;
  @Input() format: 'count' | 'money' = 'count';
  @Input() unit='';
  @Input() description='';
  @Input() loading=false;
  get validValue(): number | null {return typeof this.value==='number' && Number.isFinite(this.value) ? this.value : null;}
  get digits() {return this.format==='money' ? MONEY_DIGITS : COUNT_DIGITS;}
}
