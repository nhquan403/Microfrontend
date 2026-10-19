import { mount, shadow } from '../test-utils';

describe('mf-app-header', () => {
  it('renders a header with brand and user slots', async () => {
    const el = await mount('mf-app-header');
    const root = shadow(el);
    expect(root.querySelector('header')).not.toBeNull();
    expect(root.querySelector('slot[name="brand"]')).not.toBeNull();
    expect(root.querySelector('slot[name="user"]')).not.toBeNull();
  });

  it('uses a configurable logout label', async () => {
    const el = await mount('mf-app-header', (h) =>
      h.setAttribute('logout-label', 'Sign out'),
    );
    expect(el.logoutLabel).toBe('Sign out');
    expect(shadow(el).querySelector('button')?.textContent?.trim()).toBe(
      'Sign out',
    );
  });

  it('dispatches a bubbling, composed mf-logout event on logout click', async () => {
    const el = await mount('mf-app-header');
    const listener = vi.fn();
    document.addEventListener('mf-logout', listener);
    try {
      shadow(el).querySelector('button')?.click();
      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    } finally {
      document.removeEventListener('mf-logout', listener);
    }
  });
});
