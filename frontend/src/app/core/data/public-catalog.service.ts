import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Page } from './api-contracts';
export interface PublicProduct {product_id: number; product_name: string; category: string | null;}
export type PublicProductOrdering = 'product_id' | '-product_id';
@Injectable({providedIn: 'root'})
export class PublicCatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl.replace(/\/$/, '') + '/catalog/';
  products(search: string, category: string, page: number, ordering: PublicProductOrdering = 'product_id') {
    let params = new HttpParams().set('page', page);
    if (search.trim()) params = params.set('search', search.trim());
    if (category) params = params.set('category', category);
    if (ordering !== 'product_id') params = params.set('ordering', ordering);
    return this.http.get<Page<PublicProduct>>(this.base + 'products/', {params});
  }
  categories() {return this.http.get<{results: string[]}>(this.base + 'categories/');}
}
