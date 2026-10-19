import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Sends the user back through login when the BFF reports the session has ended. */
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        window.location.assign(
          `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
        );
      }
      return throwError(() => error);
    }),
  );
