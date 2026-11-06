import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "../store";
@Component({
  imports: [FormsModule],
  template: `<h1>Connection</h1>
    <p class="subtitle">
      Connect to the team backend, or open the sample workspace.
    </p>
    <section class="panel narrow">
      @if (data.mode === "api") {
        <form (ngSubmit)="connect()">
          <label
            >Backend access token<input
              type="password"
              name="token"
              [(ngModel)]="token"
              autocomplete="off"
              required
              [disabled]="busy()"
          /></label>
          <p class="hint">
            Use the token provided by your backend teammate. It stays in memory
            until refresh or disconnect.
          </p>
          <div class="actions">
            <button [disabled]="busy() || !token.trim()">Connect</button
            ><button
              type="button"
              class="secondary"
              [disabled]="busy()"
              (click)="data.disconnect()"
            >
              Disconnect
            </button>
          </div>
        </form>
        <p class="hint">Current role: {{ data.api.role() }}</p>
        <button
          class="secondary"
          [disabled]="busy() || !data.api.connected()"
          (click)="refresh()"
        >
          Refresh data
        </button>
        <hr />
        <p>
          Demo uses sample records. Changes reset on refresh and never reach the
          database.
        </p>
        <button class="secondary" [disabled]="busy()" (click)="demo()">
          Open demo
        </button>
      } @else {
        <p class="note">Demo mode is active. No database writes.</p>
        <button [disabled]="busy()" (click)="data.useApi()">
          Return to API mode
        </button>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </section>`,
})
export class ConnectionPage {
  readonly data = inject(Store);
  readonly error = signal("");
  token = "";
  busy() {
    return this.data.loading() || this.data.busy();
  }
  async connect() {
    if (this.busy()) return;
    const token = this.token;
    this.token = "";
    this.error.set("");
    try {
      await this.data.connect(token);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async demo() {
    this.error.set("");
    try {
      await this.data.useDemo();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async refresh() {
    this.error.set("");
    try {
      await this.data.refresh();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
