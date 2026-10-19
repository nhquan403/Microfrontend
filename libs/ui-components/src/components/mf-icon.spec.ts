import { MF_ICON_NAMES } from './mf-icon';
import { mount, shadow } from '../test-utils';

describe('mf-icon', () => {
  it('renders an inline decorative svg for every built-in icon', async () => {
    for (const name of MF_ICON_NAMES) {
      const el = await mount('mf-icon', (i) => (i.name = name));
      const svg = shadow(el).querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.querySelector('path, circle, rect')).not.toBeNull();
    }
  });

  it('exposes role="img" with aria-label when labelled', async () => {
    const el = await mount('mf-icon', (i) => {
      i.name = 'home';
      i.label = 'Home';
    });
    const svg = shadow(el).querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Home');
    expect(svg?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('renders nothing for an unknown icon name', async () => {
    const el = await mount('mf-icon', (i) => (i.name = 'does-not-exist'));
    expect(shadow(el).querySelector('svg')).toBeNull();
  });

  it('does not resolve prototype keys as icons', async () => {
    const el = await mount('mf-icon', (i) => (i.name = 'toString'));
    expect(shadow(el).querySelector('svg')).toBeNull();
  });
});
