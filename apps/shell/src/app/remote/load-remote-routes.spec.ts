import type { RegistryItem } from '@mf/shell-auth';
import { RemoteErrorPage } from '../pages/remote-error.page';
import { loadRemoteRoutes } from './load-remote-routes';

const item: RegistryItem = {
  name: 'demo',
  title: 'Demo',
  route: 'demo',
  exposedModule: './routes',
  requiredRoles: [],
};

describe('loadRemoteRoutes', () => {
  beforeEach(() =>
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  );
  afterEach(() => vi.restoreAllMocks());

  it('returns the routes a healthy remote exposes', async () => {
    const routes = [{ path: '' }];
    expect(await loadRemoteRoutes(async () => ({ routes }), item)).toBe(routes);
  });

  it('falls back to the error page when the remote cannot be fetched', async () => {
    const routes = await loadRemoteRoutes(async () => {
      throw new TypeError('Failed to fetch dynamically imported module');
    }, item);
    expect(routes).toEqual([
      { path: '**', component: RemoteErrorPage, data: { remoteTitle: 'Demo' } },
    ]);
  });

  it('falls back when the remote breaks the routes contract', async () => {
    const routes = await loadRemoteRoutes(
      async () => ({ Component: class {} }),
      item,
    );
    expect(routes[0].component).toBe(RemoteErrorPage);
  });

  it('falls back when loading hangs past the timeout', async () => {
    vi.useFakeTimers();
    const pending = loadRemoteRoutes(
      () => new Promise(() => undefined),
      item,
      50,
    );
    await vi.advanceTimersByTimeAsync(60);
    expect((await pending)[0].component).toBe(RemoteErrorPage);
    vi.useRealTimers();
  });
});
