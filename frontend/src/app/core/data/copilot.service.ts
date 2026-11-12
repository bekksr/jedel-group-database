import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../../auth';

export interface CatalogProduct {product_id: number; product_name: string; category: string | null;}
export interface SearchResult {results: CatalogProduct[]; truncated: boolean; source: string; message?: string; filters: {query: string; category: string; match: string};}
export interface CopilotCapabilities {product_search: boolean; offer_comparison: boolean; inventory: boolean; order_draft: boolean; order_status: boolean; chat_configured: boolean; chat_scope: string; chat_status?: 'disabled'|'missing_key'|'invalid_configuration'|'missing_sdk'|'configured_unverified';}
export interface Offer {reference: string; supplier_id: number; supplier_name: string; unit_price: string; quantity: number; subtotal: string; delivery_cost: string; total: string; effective_unit_cost: string; currency: string; unit: string; delivery_days: number; available_quantity: number; min_order_quantity: number; source: string; specifications: string; quoted_at: string; valid_until: string | null; eligible: boolean; warnings: string[]; rank?: number;}
export interface Comparison {results: Offer[]; best_reference: string | null; warnings: string[]; assumptions?: string[]; ranking_reason?: string; imported_at?: string; source_type?: string;}
export interface Inventory {results: (CatalogProduct & {stock_quantity: number})[]; threshold: number; threshold_basis: string; guidance: string; truncated: boolean;}
export interface OrderDraft {draft_only: boolean; persisted: boolean; supplier: {supplier_id: number; supplier_name: string}; items: {product_id: number; product_name: string; quantity: number; unit_price: string; subtotal: string}[]; currency: string; source: string; warnings: string[];}
export type ChatResult = {kind:'conversation'|'guidance';message:string;source:string} | (SearchResult & {kind: 'ai_interpreted_catalog_search'}) | {kind:'inventory';message:string;inventory:Inventory} | {kind:'draft';message:string;draft:OrderDraft} | {kind:'order_status';message:string;order_status:{order_id:number;status:string}};

@Injectable({providedIn: 'root'})
export class CopilotService {
  private http = inject(HttpClient);
  private auth = inject(Auth);
  private base = this.auth.base.replace(/auth\/$/, 'ai/');
  capabilities() {return firstValueFrom(this.http.get<CopilotCapabilities>(this.base + 'capabilities/'));}
  suppliers() {return firstValueFrom(this.http.get<{results: {supplier_id: number; supplier_name: string}[]}>(this.base + 'suppliers/'));}
  async post<T>(path: string, value: object): Promise<T> {
    await this.auth.csrf();
    return firstValueFrom(this.http.post<T>(this.base + path + '/', value));
  }
}
