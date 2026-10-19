import { readFileSync } from 'node:fs';
import { hasAllRoles } from '../auth/roles';

export interface RemoteEntry {
  name: string;
  title: string;
  icon?: string;
  /** Shell route segment, e.g. `demo` for `/demo`. */
  route: string;
  /** Same-origin URL of the remote's `remoteEntry.json`, always under `/apps/<name>/`. */
  remoteEntry: string;
  exposedModule: string;
  requiredRoles: string[];
  /** Dev server the gateway proxies to in `proxy` mode. */
  devUrl?: string;
  /** Built browser output the gateway serves in `static` mode. */
  staticDir?: string;
}

/** What the browser receives: enough to register remotes and draw the sidebar, nothing more. */
export interface RegistryResponse {
  manifest: Record<string, string>;
  items: {
    name: string;
    title: string;
    icon?: string;
    route: string;
    exposedModule: string;
  }[];
}

const NAME = /^[a-z][a-z0-9-]{0,40}$/;
const ROUTE = /^[a-z0-9][a-z0-9-/]{0,80}$/;

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`registry: "${field}" must be a non-empty string`);
  }
}

/**
 * Validates registry entries strictly. The registry is server-owned configuration; nothing
 * in it ever comes from a request, and remote URLs are pinned to the gateway's own origin.
 */
export function parseRegistry(raw: unknown): RemoteEntry[] {
  const remotes = (raw as { remotes?: unknown })?.remotes;
  if (!Array.isArray(remotes))
    throw new Error('registry: "remotes" must be an array');
  const seen = new Set<string>();
  return remotes.map((r: Record<string, unknown>) => {
    assertString(r['name'], 'name');
    assertString(r['title'], 'title');
    assertString(r['route'], 'route');
    assertString(r['remoteEntry'], 'remoteEntry');
    assertString(r['exposedModule'], 'exposedModule');
    const name = r['name'];
    if (!NAME.test(name)) throw new Error(`registry: invalid name "${name}"`);
    if (seen.has(name)) throw new Error(`registry: duplicate name "${name}"`);
    seen.add(name);
    if (!ROUTE.test(r['route']))
      throw new Error(`registry: invalid route for "${name}"`);
    if (!r['remoteEntry'].startsWith(`/apps/${name}/`)) {
      throw new Error(
        `registry: remoteEntry for "${name}" must live under /apps/${name}/`,
      );
    }
    const roles = r['requiredRoles'];
    if (!Array.isArray(roles) || !roles.every((x) => typeof x === 'string')) {
      throw new Error(
        `registry: requiredRoles for "${name}" must be a string array`,
      );
    }
    return {
      name,
      title: r['title'],
      icon: typeof r['icon'] === 'string' ? r['icon'] : undefined,
      route: r['route'],
      remoteEntry: r['remoteEntry'],
      exposedModule: r['exposedModule'],
      requiredRoles: roles as string[],
      devUrl: typeof r['devUrl'] === 'string' ? r['devUrl'] : undefined,
      staticDir:
        typeof r['staticDir'] === 'string' ? r['staticDir'] : undefined,
    };
  });
}

export function loadRegistry(file: string): RemoteEntry[] {
  return parseRegistry(JSON.parse(readFileSync(file, 'utf8')));
}

export function registryFor(
  entries: RemoteEntry[],
  roles: readonly string[],
): RegistryResponse {
  const visible = entries.filter((e) => hasAllRoles(roles, e.requiredRoles));
  return {
    manifest: Object.fromEntries(visible.map((e) => [e.name, e.remoteEntry])),
    items: visible.map(({ name, title, icon, route, exposedModule }) => ({
      name,
      title,
      icon,
      route,
      exposedModule,
    })),
  };
}
