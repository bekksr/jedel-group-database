import { Component, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../auth';
import { CopilotService, CopilotCapabilities, CatalogProduct, SearchResult, Comparison, Inventory, OrderDraft, ChatResult } from '../core/data/copilot.service';
import { apiError } from '../core/data/api-errors';

@Component({selector: 'app-copilot', imports: [FormsModule, RouterLink], templateUrl: './copilot.html', styleUrl: './copilot.scss'})
export class CopilotPage {
  auth = inject(Auth); api = inject(CopilotService);
  caps = signal<CopilotCapabilities | null>(null); busy = signal(false); error = signal('');
  searchResult = signal<SearchResult | null>(null); selected = signal<CatalogProduct | null>(null);
  comparison = signal<Comparison | null>(null); inventory = signal<Inventory | null>(null); draft = signal<OrderDraft | null>(null);
  suppliers = signal<{supplier_id: number; supplier_name: string}[]>([]);
  messages = signal<{kind: 'user' | 'assistant'; text: string}[]>([]);
  status = signal<{order_id: number; status: string} | null>(null);
  query = ''; category = ''; match = 'partial'; message = ''; consent = false;
  quantity = 1; supplierId = 0; csv = ''; approved = false; equivalent = false;
  deliveryDays: number | null = null; threshold = 20; inventoryCategory = ''; lowOnly = true; orderId = 0;
  private generation = 0;
  private retryAction?: () => Promise<void>;
  constructor() {
    effect(() => {
      this.auth.user(); this.generation++;
      this.caps.set(null); this.error.set(''); this.busy.set(false); this.suppliers.set([]);
      this.searchResult.set(null); this.selected.set(null); this.comparison.set(null); this.inventory.set(null); this.draft.set(null); this.status.set(null); this.messages.set([]);
      this.csv = ''; this.consent = false; this.approved = false; this.equivalent = false; this.retryAction = undefined;
      this.message = ''; this.supplierId = 0; this.orderId = 0;
      const generation = this.generation;
      void this.loadCapabilities(generation).catch(error => {if (generation === this.generation) this.error.set(this.failure(error));});
    });
  }
  private async loadCapabilities(generation: number) {
    const caps = await this.api.capabilities();
    if (generation !== this.generation) return;
    this.caps.set(caps);
    if(caps.order_draft) {
      const suppliers = await this.api.suppliers();
      if(generation === this.generation) this.suppliers.set(suppliers.results);
    }
  }
  private async run(action: () => Promise<void>) {
    if (this.busy()) return;
    const generation = this.generation;
    this.busy.set(true); this.error.set(''); this.retryAction = action;
    try {await action();} catch (error) {if (generation === this.generation) this.error.set(this.failure(error));} finally {if (generation === this.generation) this.busy.set(false);}
  }
  private failure(error: unknown) {
    if(error instanceof HttpErrorResponse) {
      if(error.status === 0) return 'Cannot reach the Copilot API. Check that Django is running, then retry. These tools do not write business records.';
      if(error.status === 503) return typeof error.error?.detail === 'string' ? error.error.detail : 'The assistant service is unavailable. No business records were changed.';
      if(error.status === 429) return 'Assistant request limit reached. Wait before retrying; ordinary ERP pages remain available.';
    }
    return apiError(error);
  }
  retry() {if (this.retryAction) return this.run(this.retryAction); return this.reload();}
  private async reload() {const generation = this.generation; return this.run(() => this.loadCapabilities(generation));}
  search() {const generation = this.generation; return this.run(async () => {
    this.searchResult.set(null);
    const result = await this.api.post<SearchResult>('products/search', {query: this.query, category: this.category, match: this.match});
    if (generation === this.generation) this.searchResult.set(result);
  });}
  choose(product: CatalogProduct) {this.selected.set(product); this.comparison.set(null); this.draft.set(null);}
  async loadFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 65536) {this.error.set('Quotation CSV must be under 64 KiB.'); return;}
    const generation = this.generation;
    try {const text = new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer()); if (generation === this.generation) {this.csv = text; this.comparison.set(null);}}
    catch {this.error.set('Could not read the quotation file. Supply a valid UTF-8 CSV.');}
  }
  compare() {const generation = this.generation; return this.run(async () => {
    this.comparison.set(null);
    const result = await this.api.post<Comparison>('offers/compare', {product_id: this.selected()?.product_id, quantity: this.quantity, csv: this.csv, approved_source: this.approved, equivalence_confirmed: this.equivalent, max_delivery_days: this.deliveryDays});
    if (generation === this.generation) this.comparison.set(result);
  });}
  loadInventory() {const generation = this.generation; return this.run(async () => {
    this.inventory.set(null);
    const result = await this.api.post<Inventory>('inventory', {category: this.inventoryCategory, threshold: this.threshold, low_only: this.lowOnly});
    if (generation === this.generation) this.inventory.set(result);
  });}
  prepare() {const generation = this.generation; return this.run(async () => {
    this.draft.set(null);
    const result = await this.api.post<OrderDraft>('orders/draft', {product_id: this.selected()?.product_id, quantity: this.quantity, supplier_id: +this.supplierId});
    if (generation === this.generation) this.draft.set(result);
  });}
  orderStatus() {const generation = this.generation; return this.run(async () => {
    this.status.set(null);
    const result = await this.api.post<{order_id: number; status: string}>('orders/status', {order_id: this.orderId});
    if (generation === this.generation) this.status.set(result);
  });}
  localCapability(): 'inventory' | 'order_draft' | 'order_status' | null {
    const text = this.message.trim().replace(/[.?!]+$/, '').trim();
    if (/^(which products have low stock|what items should we consider purchasing|show low stock|\u043a\u0430\u043a\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u044b \u0437\u0430\u043a\u0430\u043d\u0447\u0438\u0432\u0430\u044e\u0442\u0441\u044f|\u043f\u043e\u043a\u0430\u0436\u0438 \u0442\u043e\u0432\u0430\u0440\u044b \u0441 \u043d\u0438\u0437\u043a\u0438\u043c \u043e\u0441\u0442\u0430\u0442\u043a\u043e\u043c)$/i.test(text) || /^show inventory levels for category .{1,50}$/i.test(text)) return 'inventory';
    if (/^(?:help me )?prepare a purchase order for \d{1,7} units of product #?\d{1,10} from supplier #?\d{1,10}$/i.test(text)) return 'order_draft';
    if (/^show purchase order #?\d{1,10} status$/i.test(text)) return 'order_status';
    return null;
  }
  localMessage() {return this.localCapability() !== null;}
  canSend() {
    if (this.auth.restoring() || !this.caps() || !this.auth.user() || !this.message.trim()) return false;
    const local = this.localCapability();
    return local ? !!this.caps()?.[local] : !!this.caps()?.chat_configured && this.consent;
  }
  sendHint() {
    if (this.auth.restoring() || !this.caps()) return 'Wait for session and tool permissions to finish loading.';
    if (!this.auth.user()) return 'Log in to submit a question. Public catalog filters work without login.';
    if (!this.message.trim()) return 'Enter a question, or choose an available local example below.';
    const local = this.localCapability();
    if (local) return this.caps()?.[local] ? 'Ready: this question runs locally in Django. No Groq key, consent or API credits are needed.' : 'Your assigned role cannot use this local tool. Request access from your administrator; logging in again does not grant permission.';
    if (!this.caps()?.chat_configured) return 'This wording needs optional AI interpretation, which is not configured. Use catalog filters or one of the supported local questions.';
    if (!this.consent) return 'Select the Groq consent checkbox above to enable Ask Copilot. Do not include confidential information.';
    return 'Ready: this message will be sent to the configured Groq provider and uses your Groq account quota; no provider fallback is used.';
  }
  suggestInventory() {this.message = 'Which products have low stock?';}
  chat() {const text = this.message.trim(); if (!text) return; const generation = this.generation; return this.run(async () => {
    const result = await this.api.post<ChatResult>('chat', {message: text, consent_to_provider: this.consent});
    if (generation === this.generation) {
      this.messages.update(messages => [...messages.slice(-8), {kind: 'user', text}, {kind: 'assistant', text: (result.kind === 'conversation' ? 'Groq - General conversation (not database facts): ' : '') + (result.message ?? 'Catalog search completed.')}]);
      if(result.kind === 'inventory') this.inventory.set(result.inventory);
      else if(result.kind === 'draft') this.draft.set(result.draft);
      else if(result.kind === 'order_status') this.status.set(result.order_status);
      else if(result.kind === 'ai_interpreted_catalog_search') this.searchResult.set(result);
      this.message = '';
    }
  });}
}
