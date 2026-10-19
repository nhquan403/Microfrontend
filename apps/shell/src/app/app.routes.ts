import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { roleGuard, type RegistryItem } from '@mf/shell-auth';
import { ForbiddenPage } from './pages/forbidden.page';
import { HomePage } from './pages/home.page';
import { NotFoundPage } from './pages/not-found.page';
import { loadRemoteRoutes } from './remote/load-remote-routes';
import { REMOTE_LOADER } from './remote/remote-loader';

/**
 * Static shell pages, one lazily federated route per remote the user may open, and a
 * forbidden page for remotes they may not (the BFF only reveals those route segments).
 */
export function buildRoutes(
  items: RegistryItem[],
  restrictedRoutes: string[],
): Routes {
  const remoteRoutes: Routes = items.map((item) => ({
    path: item.route,
    title: item.title,
    canMatch: [roleGuard(item.requiredRoles)],
    loadChildren: () => loadRemoteRoutes(inject(REMOTE_LOADER), item),
  }));

  const restricted: Routes = restrictedRoutes.map((route) => ({
    path: route,
    redirectTo: '/forbidden',
  }));

  return [
    { path: '', pathMatch: 'full', component: HomePage, title: 'Home' },
    ...remoteRoutes,
    ...restricted,
    { path: 'forbidden', component: ForbiddenPage, title: 'Forbidden' },
    { path: '**', component: NotFoundPage, title: 'Not found' },
  ];
}
