import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Page } from './api-contracts';
export interface PublicProduct {product_id: number; product_name: string; category: string | null;}
@Injectable({providedIn: 'root'})
export class PublicCatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl.replace(/\/$/, '') + '/catalog/';
  products(search: string, category: string, page: number) {
    let params = new HttpParams().set('page', page);
    if (search.trim()) params = params.set('search', search.trim());
    if (category) params = params.set('category', category);
    return this.http.get<Page<PublicProduct>>(this.base + 'products/', {params});
  }
  categories() {return this.http.get<{results: string[]}>(this.base + 'categories/');}
}
