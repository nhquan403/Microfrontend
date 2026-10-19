import { mount, shadow } from '../test-utils';

describe('mf-app-footer', () => {
  it('renders a footer with a default slot for content', async () => {
    const el = await mount(
      'mf-app-footer',
      (f) => (f.textContent = '(c) 2026'),
    );
    expect(shadow(el).querySelector('footer slot')).not.toBeNull();
    expect(el.textContent).toBe('(c) 2026');
  });
});
