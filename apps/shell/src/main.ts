import { initFederation } from '@angular-architects/native-federation';
import type { CurrentUser, RegistryItem } from '@mf/shell-auth';
import { nonceImportMap, pageNonce } from './federation/nonce-import-map';

interface Registry {
  manifest: Record<string, string>;
  items: RegistryItem[];
  restrictedRoutes: string[];
}

function goToLogin(): void {
  const returnTo = `${location.pathname}${location.search}`;
  location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}

async function getJson<T>(url: string): Promise<T | undefined> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401) {
    goToLogin();
    return undefined;
  }
  if (!res.ok) throw new Error(`${url} failed with ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Nothing Angular starts until the BFF confirms a session. The remote list comes only from
 * the BFF registry (already filtered by role), never from the URL or other user input.
 */
async function start(): Promise<void> {
  const user = await getJson<CurrentUser>('/auth/me');
  if (!user) return;
  const registry = await getJson<Registry>('/registry');
  if (!registry) return;

  const federation = await initFederation(registry.manifest, {
    hostRemoteEntry: { url: './remoteEntry.json' },
    setImportMapFn: nonceImportMap(pageNonce(), 'importmap-shim'),
  });

  const { bootstrap } = await import('./bootstrap');
  await bootstrap({
    user,
    items: registry.items,
    restrictedRoutes: registry.restrictedRoutes,
    loadRemoteModule: (remoteName, exposedModule) =>
      federation.loadRemoteModule(remoteName, exposedModule),
  });
}

start().catch((error) => console.error('Shell failed to start', error));
