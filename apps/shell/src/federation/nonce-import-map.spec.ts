import { nonceImportMap, pageNonce } from './nonce-import-map';

describe('nonceImportMap', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<sh-root ngCspNonce="abc123"></sh-root>';
  });

  it('reads the page nonce from the root element', () => {
    expect(pageNonce()).toBe('abc123');
  });

  it('inserts the import map with the page nonce', async () => {
    const map = { imports: { '@angular/core': './core.js' } };
    await nonceImportMap('abc123', 'importmap-shim')(map);
    const script = document.head.querySelector<HTMLScriptElement>(
      'script[type="importmap-shim"]',
    );
    expect(script?.nonce).toBe('abc123');
    expect(JSON.parse(script?.textContent ?? '{}')).toEqual(map);
  });

  it('replaces existing maps when asked to override', async () => {
    const set = nonceImportMap('n', 'importmap');
    await set({ imports: { a: './a.js' } });
    await set({ imports: { b: './b.js' } }, { override: true });
    const scripts = document.head.querySelectorAll('script[type="importmap"]');
    expect(scripts.length).toBe(1);
    expect(scripts[0].textContent).toContain('b.js');
  });
});
