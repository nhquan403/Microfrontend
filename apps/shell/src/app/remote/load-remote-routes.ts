import type { Routes } from '@angular/router';
import type { RegistryItem } from '@mf/shell-auth';
import { RemoteErrorPage } from '../pages/remote-error.page';
import type { LoadRemoteModule } from './remote-loader';

export const REMOTE_LOAD_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Loads a remote's `./routes`. Any failure (remote down, 404, version mismatch, a module
 * that breaks the contract, or a hang) is contained to the content area: the remote's
 * route renders an error page while the shell layout keeps working.
 */
export async function loadRemoteRoutes(
  load: LoadRemoteModule,
  item: RegistryItem,
  timeoutMs = REMOTE_LOAD_TIMEOUT_MS,
): Promise<Routes> {
  try {
    const module = await withTimeout(
      load(item.name, item.exposedModule),
      timeoutMs,
    );
    const routes = (module as { routes?: unknown } | undefined)?.routes;
    if (!Array.isArray(routes)) {
      throw new Error(`remote "${item.name}" does not export routes`);
    }
    return routes as Routes;
  } catch (error) {
    console.error(`Remote "${item.name}" could not be loaded`, error);
    return [
      {
        path: '**',
        component: RemoteErrorPage,
        data: { remoteTitle: item.title },
      },
    ];
  }
}
