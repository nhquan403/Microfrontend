import {
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  CURRENT_USER,
  REGISTRY_ITEMS,
  sessionExpiredInterceptor,
} from '@mf/shell-auth';
import type { ShellContext } from '../bootstrap';
import { buildRoutes } from './app.routes';
import { REMOTE_LOADER } from './remote/remote-loader';

export function createAppConfig(context: ShellContext): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideZonelessChangeDetection(),
      provideRouter(
        buildRoutes(context.items, context.restrictedRoutes),
        withComponentInputBinding(),
      ),
      // Double-submit CSRF: echo the BFF's XSRF-TOKEN cookie on state-changing requests.
      provideHttpClient(
        withXsrfConfiguration({
          cookieName: 'XSRF-TOKEN',
          headerName: 'X-XSRF-TOKEN',
        }),
        withInterceptors([sessionExpiredInterceptor]),
      ),
      { provide: CURRENT_USER, useValue: context.user },
      { provide: REGISTRY_ITEMS, useValue: context.items },
      { provide: REMOTE_LOADER, useValue: context.loadRemoteModule },
    ],
  };
}
