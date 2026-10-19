import { defineMfComponents, MF_COMPONENTS, MfButton } from './index';

describe('defineMfComponents', () => {
  it('registers every mf-* tag', () => {
    defineMfComponents();
    for (const [tag, ctor] of Object.entries(MF_COMPONENTS)) {
      expect(tag.startsWith('mf-')).toBe(true);
      expect(customElements.get(tag)).toBe(ctor);
    }
  });

  it('is idempotent: calling it twice never throws', () => {
    expect(() => {
      defineMfComponents();
      defineMfComponents();
    }).not.toThrow();
  });

  it('skips tags already registered (e.g. by another bundle) instead of redefining', () => {
    const registry = {
      get: vi.fn((tag: string) =>
        tag === 'mf-button' ? class extends HTMLElement {} : undefined,
      ),
      define: vi.fn(),
    } as unknown as CustomElementRegistry;

    defineMfComponents(registry);

    const defined = vi.mocked(registry.define).mock.calls.map(([tag]) => tag);
    expect(defined).not.toContain('mf-button');
    expect(defined).toHaveLength(Object.keys(MF_COMPONENTS).length - 1);
  });

  it('exports component classes', () => {
    expect(new MfButton()).toBeInstanceOf(HTMLElement);
  });
});
