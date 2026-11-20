import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import type { Translations } from './translations';

type Language = 'en' | 'ru' | 'kk';
const LANGUAGE_KEY = 'jedel.language';

@Injectable({ providedIn: 'root' })
export class UiLanguage {
  private readonly document = inject(DOCUMENT);
  private readonly selected = signal<Language>('en');
  private translations?: Translations;
  private request = 0;
  readonly current = this.selected.asReadonly();
  readonly loadFailed = signal(false);

  constructor() {
    try {
      const saved = this.document.defaultView?.localStorage.getItem(LANGUAGE_KEY);
      if (saved) void this.select(saved);
    } catch {
      // Storage can be unavailable in the browser.
    }
  }

  async select(language: string): Promise<void> {
    if (language !== 'en' && language !== 'ru' && language !== 'kk') return;
    const request = ++this.request;
    this.loadFailed.set(false);
    try {
      if (language !== 'en' && !this.translations) {
        this.translations = (await import('./translations')).translations;
      }
    } catch {
      if (request === this.request) this.loadFailed.set(true);
      return;
    }
    if (request !== this.request) return;

    this.selected.set(language);
    this.document.documentElement.lang = language;
    try {
      this.document.defaultView?.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // The selection still applies for the current visit.
    }
  }

  // English is the fallback for records and server messages outside the UI dictionary.
  readonly text = (english: string, values?: Record<string, string | number>): string => {
    const language = this.current();
    const copy = language === 'en' ? english : this.translations?.[english]?.[language] ?? english;
    return values
      ? copy.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder))
      : copy;
  };
}
