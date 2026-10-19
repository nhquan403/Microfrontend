import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CURRENT_USER, hasAllRoles, type CurrentUser } from './current-user';

/** Where the browser goes after logout; injectable so tests do not navigate the page. */
export const NAVIGATE_TO = Symbol('NAVIGATE_TO');

/**
 * Session facade shared by the shell and every remote (a federation singleton).
 * It exposes identity and roles only. Tokens live in the BFF and are never reachable here.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly current = signal<CurrentUser>(inject(CURRENT_USER));

  readonly user = this.current.asReadonly();

  /** Overridable in tests. */
  [NAVIGATE_TO] = (url: string) => window.location.assign(url);

  hasRoles(...roles: string[]): boolean {
    return hasAllRoles(this.current(), roles);
  }

  /** Ends the BFF session (CSRF-protected) and then the identity provider session. */
  async logout(): Promise<void> {
    const { logoutUrl } = await firstValueFrom(
      this.http.post<{ logoutUrl: string }>('/auth/logout', null),
    );
    const url = new URL(logoutUrl, window.location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Unexpected logout URL');
    }
    this[NAVIGATE_TO](url.href);
  }
}
