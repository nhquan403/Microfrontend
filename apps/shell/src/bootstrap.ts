import { bootstrapApplication } from '@angular/platform-browser';
import type { CurrentUser, RegistryItem } from '@mf/shell-auth';
import { defineMfComponents } from '@mf/ui-components';
import { App } from './app/app';
import { createAppConfig } from './app/app.config';
import type { LoadRemoteModule } from './app/remote/remote-loader';

export interface ShellContext {
  user: CurrentUser;
  items: RegistryItem[];
  restrictedRoutes: string[];
  loadRemoteModule: LoadRemoteModule;
}

export async function bootstrap(context: ShellContext): Promise<void> {
  // The design system is registered once for the whole page; remotes reuse it.
  defineMfComponents();
  await bootstrapApplication(App, createAppConfig(context));
}
