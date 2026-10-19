import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Routes } from '@angular/router';
import { CURRENT_USER, type RegistryItem } from '@mf/shell-auth';
import { buildRoutes } from './app.routes';
import { REMOTE_LOADER } from './remote/remote-loader';

@Component({ template: 'remote page', standalone: true })
class RemotePage {}

const demo: RegistryItem = {
  name: 'demo',
  title: 'Demo',
  route: 'demo',
  exposedModule: './routes',
  requiredRoles: ['demo-access'],
};

function setup(roles: string[], items: RegistryItem[], restricted: string[]) {
  const calls: [string, string][] = [];
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideRouter(buildRoutes(items, restricted)),
      { provide: CURRENT_USER, useValue: { sub: 'u', name: 'U', roles } },
      {
        provide: REMOTE_LOADER,
        useValue: async (name: string, exposed: string) => {
          calls.push([name, exposed]);
          return {
            routes: [{ path: '', component: RemotePage }] satisfies Routes,
          };
        },
      },
    ],
  });
  return { router: TestBed.inject(Router), calls };
}

describe('buildRoutes', () => {
  it('loads the remote routes through the federation loader', async () => {
    const { router, calls } = setup(['demo-access'], [demo], []);
    await router.navigateByUrl('/demo');
    expect(router.url).toBe('/demo');
    expect(calls).toEqual([['demo', './routes']]);
  });

  it('blocks a remote route when the user lacks its roles, without loading it', async () => {
    const { router, calls } = setup(['shell-user'], [demo], []);
    await router.navigateByUrl('/demo');
    expect(router.url).toBe('/forbidden');
    expect(calls).toEqual([]);
  });

  it('sends restricted routes to the forbidden page', async () => {
    const { router, calls } = setup(['shell-user'], [], ['demo']);
    await router.navigateByUrl('/demo');
    expect(router.url).toBe('/forbidden');
    expect(calls).toEqual([]);
  });

  it('shows not-found for unknown routes', async () => {
    const { router } = setup(['shell-user'], [], []);
    await router.navigateByUrl('/nope');
    expect(router.url).toBe('/nope');
    const last = router.config[router.config.length - 1];
    expect(last.path).toBe('**');
  });
});
