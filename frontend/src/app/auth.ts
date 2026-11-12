import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, catchError, throwError } from 'rxjs';
import { environment } from '../environments/environment';

export interface Account { username: string; name: string; email: string; role: string; can_administer?: boolean; can_manage_security?: boolean; capabilities: {read: boolean; manage_catalog?: boolean; create_orders?: boolean; transition_orders?: boolean; delete_records?: boolean}; }
@Injectable({providedIn: 'root'})
export class Auth {
  private http = inject(HttpClient);
  readonly user = signal<Account | null>(null);
  readonly restoring = signal(false);
  readonly base = environment.apiBaseUrl.replace(/\/$/, '') + '/auth/';
  private pending?: Promise<boolean>;
  private generation = 0;
  async restore(): Promise<boolean> {
    if (this.user()) return true;
    const generation = this.generation;
    this.restoring.set(true);
    return this.pending ??= firstValueFrom(this.http.get<Account>(this.base + 'me/'))
      .then(user => { if (generation === this.generation) this.user.set(user); return !!this.user(); })
      .catch(() => { if (generation === this.generation) this.user.set(null); return !!this.user(); }).finally(() => { this.pending = undefined; this.restoring.set(false); });
  }
  async csrf() { await firstValueFrom(this.http.get(this.base + 'csrf/')); }
  async login(identifier: string, password: string) {
    await this.csrf();
    const user = await firstValueFrom(this.http.post<Account>(this.base + 'login/', {identifier, password}));
    this.generation++; this.user.set(user);
  }
  async register(value: {name: string; email: string; password: string; password_confirm?: string}) {
    await this.csrf();
    await firstValueFrom(this.http.post(this.base + 'register/', value));
    this.generation++; this.user.set(null);
    try { this.user.set(await firstValueFrom(this.http.get<Account>(this.base + 'me/'))); }
    catch { throw new Error('Your account was created, but the session could not be confirmed. Try logging in before registering again.'); }
  }
  async logout() {
    await this.csrf();
    await firstValueFrom(this.http.post(this.base + 'logout/', {}));
    this.generation++; this.user.set(null);
  }
}
export const accountGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Auth); const router = inject(Router);
  return await auth.restore() ? true : router.createUrlTree(['/auth'], {queryParams: {mode: 'login', returnTo: state.url}});
};
export const businessGuard: CanActivateFn = async () => {
  const auth = inject(Auth); const router = inject(Router);
  return await auth.restore() && auth.user()?.capabilities.read ? true : router.parseUrl('/access-denied');
};
export function safeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/^\/(auth|login|register)([/?#]|$)/.test(value) ? value : '/';
}
export const capabilityGuard: CanActivateFn = async (route, state) => {
  const auth = inject(Auth); const router = inject(Router);
  if (!await auth.restore()) return router.createUrlTree(['/auth'], {queryParams: {mode: 'login', returnTo: state.url}});
  const key = route.data['capability'] as keyof Account['capabilities'];
  return auth.user()?.capabilities[key] ? true : router.parseUrl('/access-denied');
};
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth); const router = inject(Router);
  return next(req).pipe(catchError((error: HttpErrorResponse) => {
    if (req.url.startsWith(environment.apiBaseUrl + '/') && (error.status === 401 || (error.status === 403 && error.error?.detail === 'Authentication credentials were not provided.'))) {
      if (!req.url.endsWith('/auth/me/')) auth.user.set(null);
      if (!req.url.endsWith('/auth/me/') && !['/auth', '/login', '/register'].includes(router.url.split('?')[0]!)) {
        void router.navigate(['/auth'], {queryParams: {mode: 'login', returnTo: router.url}});
      }
    }
    return throwError(() => error);
  }));
};
