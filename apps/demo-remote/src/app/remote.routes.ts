import type { Routes } from '@angular/router';
import { DemoDetailPage } from './pages/demo-detail.page';
import { DemoHomePage } from './pages/demo-home.page';

/**
 * The remote's public contract: the shell mounts these under the route the registry assigns
 * (e.g. `/demo`). Everything runs inside the shell's injector, so `AuthService`, `HttpClient`
 * (with CSRF and session-expiry handling) and the design system come from the shell.
 */
export const routes: Routes = [
  { path: '', component: DemoHomePage, title: 'Demo' },
  { path: 'items/:id', component: DemoDetailPage, title: 'Demo item' },
];
