import { isSafeRoute, type MfSidebarItem } from './mf-sidebar';
import { mount, shadow } from '../test-utils';

const items: MfSidebarItem[] = [
  { name: 'home', title: 'Home', route: '/', icon: 'home' },
  { name: 'orders', title: 'Orders', route: '/orders' },
  { name: 'settings', title: 'Settings', route: '/settings', icon: 'settings' },
];

function links(el: Element): HTMLAnchorElement[] {
  return [...shadow(el).querySelectorAll('a')];
}

describe('mf-sidebar', () => {
  it('renders a labelled nav with one link per item', async () => {
    const el = await mount('mf-sidebar', (s) => (s.items = items));
    const nav = shadow(el).querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Main navigation');
    const anchors = links(el);
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/orders',
      '/settings',
    ]);
    expect(anchors.map((a) => a.textContent?.trim())).toEqual([
      'Home',
      'Orders',
      'Settings',
    ]);
    expect(anchors[0].querySelector('mf-icon')?.getAttribute('name')).toBe(
      'home',
    );
    expect(anchors[1].querySelector('mf-icon')).toBeNull();
  });

  it('accepts a custom aria-label', async () => {
    const el = await mount('mf-sidebar', (s) =>
      s.setAttribute('label', 'Apps'),
    );
    expect(shadow(el).querySelector('nav')?.getAttribute('aria-label')).toBe(
      'Apps',
    );
  });

  it('marks only the active item with aria-current="page"', async () => {
    const el = await mount('mf-sidebar', (s) => {
      s.items = items;
      s.active = '/orders';
    });
    expect(links(el).map((a) => a.getAttribute('aria-current'))).toEqual([
      null,
      'page',
      null,
    ]);

    el.active = '/settings';
    await el.updateComplete;
    expect(links(el).map((a) => a.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'page',
    ]);
  });

  it('treats nested routes as active but not for the root item', async () => {
    const el = await mount('mf-sidebar', (s) => {
      s.items = items;
      s.active = '/orders/42';
    });
    expect(links(el).map((a) => a.getAttribute('aria-current'))).toEqual([
      null,
      'page',
      null,
    ]);
  });

  it('prevents navigation and dispatches mf-navigate with the route', async () => {
    const el = await mount('mf-sidebar', (s) => (s.items = items));
    const listener = vi.fn();
    el.addEventListener('mf-navigate', listener);

    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    links(el)[1].dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ route: '/orders' });
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('leaves modified clicks (open in new tab) to the browser', async () => {
    const el = await mount('mf-sidebar', (s) => (s.items = items));
    const listener = vi.fn();
    el.addEventListener('mf-navigate', listener);

    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    links(el)[1].dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('links are keyboard focusable', async () => {
    const el = await mount('mf-sidebar', (s) => (s.items = items));
    const anchor = links(el)[0];
    anchor.focus();
    expect(shadow(el).activeElement).toBe(anchor);
  });

  it('drops items whose route is not app-relative', async () => {
    const el = await mount('mf-sidebar', (s) => {
      s.items = [
        ...items,
        { name: 'evil', title: 'Evil', route: 'javascript:alert(1)' },
        { name: 'ext', title: 'External', route: '//evil.example' },
      ];
    });
    expect(links(el)).toHaveLength(3);
  });

  it('isSafeRoute accepts only single-slash relative paths', () => {
    expect(isSafeRoute('/a/b')).toBe(true);
    expect(isSafeRoute('//host')).toBe(false);
    expect(isSafeRoute('https://x')).toBe(false);
    expect(isSafeRoute(undefined)).toBe(false);
  });
});
