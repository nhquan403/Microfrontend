import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MF_TOKEN_NAMES, mfVar, tokensCssPath } from './index';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const css = readFileSync(resolve(workspaceRoot, tokensCssPath), 'utf8');

function blockBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1)
    throw new Error(`Selector ${selector} not found in tokens.css`);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

function declaredNames(body: string): string[] {
  return [...body.matchAll(/(--mf-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
}

describe('design tokens', () => {
  const rootNames = declaredNames(blockBody(':root'));
  const darkNames = declaredNames(blockBody("[data-theme='dark']"));

  it('tokensCssPath points at an existing stylesheet', () => {
    expect(css.length).toBeGreaterThan(0);
  });

  it('MF_TOKEN_NAMES matches exactly the variables declared in :root', () => {
    expect([...rootNames].sort()).toEqual([...MF_TOKEN_NAMES].sort());
  });

  it('declares no duplicate tokens', () => {
    expect(new Set(rootNames).size).toBe(rootNames.length);
  });

  it('uses the --mf- prefix with kebab-case for every token', () => {
    for (const name of MF_TOKEN_NAMES) {
      expect(name).toMatch(
        /^--mf-(color|space|radius|font|shadow)-[a-z0-9]+(-[a-z0-9]+)*$/,
      );
    }
  });

  it('dark theme overrides every color token and nothing unknown', () => {
    const colorTokens = MF_TOKEN_NAMES.filter((n) =>
      n.startsWith('--mf-color-'),
    );
    for (const name of colorTokens) expect(darkNames).toContain(name);
    for (const name of darkNames) expect(MF_TOKEN_NAMES).toContain(name);
  });

  it('every surface/fill color has an on-* contrast pair', () => {
    for (const role of ['primary', 'surface', 'danger', 'success']) {
      expect(MF_TOKEN_NAMES).toContain(`--mf-color-on-${role}`);
    }
  });

  it('mfVar builds var() references with optional fallback', () => {
    expect(mfVar('--mf-space-md')).toBe('var(--mf-space-md)');
    expect(mfVar('--mf-color-primary', 'blue')).toBe(
      'var(--mf-color-primary, blue)',
    );
  });
});
