import { SectionPreview } from './section-preview';
import { AccessPrompt } from './access-prompt';
import { PublicCatalogPage } from './public-catalog';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../auth';
import { ProductsPage } from './products';
import { SuppliersPage } from './suppliers';
import { OrdersPage } from './orders';
import { AnalyticsPage } from './analytics';
import { UiLanguage } from '../core/ui-language';
import { PublicOrdersPage, PublicSuppliersPage } from './public-records';
@Component({imports: [SectionPreview, PublicCatalogPage, PublicOrdersPage, PublicSuppliersPage, ProductsPage, SuppliersPage, OrdersPage, AnalyticsPage], template: `
@if(section === 'products' && !auth.user()?.capabilities?.read) {<app-public-catalog />} @else if(auth.user()?.capabilities?.read) {
  @switch(section) {
    @case('products') {<ng-component-products />}
    @case('suppliers') {<ng-component-suppliers />}
    @case('orders') {<ng-component-orders />}
    @case('analytics') {<ng-component-analytics />}
  }
} @else if(section === 'suppliers') {<app-public-suppliers />} @else if(section === 'orders') {<app-public-orders />} @else {<app-section-preview [section]="section" />
}`})
export class PublicWorkspacePage {
  readonly auth = inject(Auth);
  readonly section = inject(ActivatedRoute).snapshot.data['section'] as string;

}
@Component({imports: [RouterLink, AccessPrompt], styles: [`app-access-prompt{margin-block-start:var(--section-gap)}`], template: `<h1>{{ text('Access denied') }}</h1><p role="alert">{{ text('Your assigned role does not permit this operation.') }}</p><a routerLink="/">{{ text('Return Home') }}</a><app-access-prompt section="" />`})
export class AccessDeniedPage {
  readonly text = inject(UiLanguage).text;
}
