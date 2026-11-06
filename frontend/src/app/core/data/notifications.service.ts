import { Injectable, signal } from "@angular/core";
export interface Notice {
  id: number;
  kind: "success" | "error" | "warning";
  message: string;
}
@Injectable({ providedIn: "root" })
export class Notifications {
  readonly messages = signal<readonly Notice[]>([]);
  private nextId = 0;
  show(kind: Notice["kind"], message: string): void {
    this.messages.update((items) => [
      ...items.slice(-3),
      { id: ++this.nextId, kind, message },
    ]);
  }
  dismiss(id: number): void {
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }
  clear(): void {
    this.messages.set([]);
  }
}
