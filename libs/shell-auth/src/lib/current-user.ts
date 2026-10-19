import { InjectionToken } from '@angular/core';

/** Identity of the signed-in user as exposed by the BFF `/auth/me` endpoint. Never contains tokens. */
export interface CurrentUser {
  sub: string;
  name: string;
  email?: string;
  roles: string[];
}

/** A remote the user may open, as returned by the BFF `/registry` endpoint. */
export interface RegistryItem {
  name: string;
  title: string;
  icon?: string;
  /** Shell route segment, e.g. `demo` for `/demo`. */
  route: string;
  exposedModule: string;
  requiredRoles: string[];
}

/** Provided by the shell at bootstrap from the `/auth/me` response. */
export const CURRENT_USER = new InjectionToken<CurrentUser>('CURRENT_USER');

/** Provided by the shell at bootstrap from the `/registry` response. */
export const REGISTRY_ITEMS = new InjectionToken<RegistryItem[]>(
  'REGISTRY_ITEMS',
);

/** True when the user holds every one of `required` roles. An empty list means no role is needed. */
export function hasAllRoles(
  user: Pick<CurrentUser, 'roles'>,
  required: readonly string[],
): boolean {
  return required.every((role) => user.roles.includes(role));
}
