import { InjectionToken } from '@angular/core';

export type LoadRemoteModule = (
  remoteName: string,
  exposedModule: string,
) => Promise<unknown>;

/** Federation's module loader, provided at bootstrap so routes and tests can swap it. */
export const REMOTE_LOADER = new InjectionToken<LoadRemoteModule>(
  'REMOTE_LOADER',
);
