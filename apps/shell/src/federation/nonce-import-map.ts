/**
 * Import maps are inline scripts, so under a nonce-based CSP the map that native federation
 * inserts at runtime must carry the page nonce. This replaces the orchestrator's default
 * `setImportMapFn` (which appends an un-nonced `<script type="importmap">`).
 */
export interface ImportMap {
  imports: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
}

/** Name allowed by the BFF CSP `trusted-types` directive. */
export const IMPORT_MAP_POLICY = 'mf-import-map';

interface TrustedTypesLike {
  createPolicy(
    name: string,
    rules: { createScript: (input: string) => string },
  ): { createScript(input: string): unknown };
}

let policy: { createScript(input: string): unknown } | undefined;

/**
 * Under `require-trusted-types-for 'script'` an inline script body must be a TrustedScript.
 * The policy only ever receives the JSON serialization of a federation import map built here.
 */
function trustedScript(json: string): string {
  const tt = (globalThis as { trustedTypes?: TrustedTypesLike }).trustedTypes;
  if (!tt) return json;
  policy ??= tt.createPolicy(IMPORT_MAP_POLICY, {
    createScript: (input) => input,
  });
  return policy.createScript(json) as string;
}

export function nonceImportMap(
  nonce: string,
  type: 'importmap' | 'importmap-shim',
  doc: Document = document,
) {
  return (
    importMap: ImportMap,
    opts: { override?: boolean } = {},
  ): Promise<ImportMap> => {
    if (opts.override) {
      doc.head
        .querySelectorAll(`script[type="${type}"]`)
        .forEach((el) => el.remove());
    }
    const script = doc.createElement('script');
    script.type = type;
    script.nonce = nonce;
    script.text = trustedScript(JSON.stringify(importMap));
    doc.head.appendChild(script);
    return Promise.resolve(importMap);
  };
}

/** The BFF stamps the per-request nonce onto the root element for Angular (`ngCspNonce`). */
export function pageNonce(doc: Document = document): string {
  return doc.querySelector('sh-root')?.getAttribute('ngCspNonce') ?? '';
}
