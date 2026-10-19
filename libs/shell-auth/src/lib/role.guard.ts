import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Hides routes the user may not open. This is a usability layer only: the BFF enforces the
 * same roles on `/registry`, `/apps/*` and `/api/*`.
 */
export function roleGuard(roles: readonly string[]): CanMatchFn {
  return () =>
    inject(AuthService).hasRoles(...roles) ||
    inject(Router).createUrlTree(['/forbidden']);
}
