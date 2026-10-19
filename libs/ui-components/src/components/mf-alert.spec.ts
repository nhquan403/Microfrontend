import { mount, shadow } from '../test-utils';

describe('mf-alert', () => {
  it('defaults to info with role="status" and an info icon', async () => {
    const el = await mount('mf-alert', (a) => (a.textContent = 'Heads up'));
    const box = shadow(el).querySelector('.alert');
    expect(el.getAttribute('variant')).toBe('info');
    expect(box?.getAttribute('role')).toBe('status');
    expect(shadow(el).querySelector('mf-icon')?.getAttribute('name')).toBe(
      'info',
    );
    expect(shadow(el).querySelector('slot')).not.toBeNull();
  });

  it('danger variant uses role="alert" and renders the heading as text', async () => {
    const el = await mount('mf-alert', (a) => {
      a.variant = 'danger';
      a.heading = '<b>Remote failed</b>';
    });
    expect(el.getAttribute('variant')).toBe('danger');
    expect(shadow(el).querySelector('.alert')?.getAttribute('role')).toBe(
      'alert',
    );
    const heading = shadow(el).querySelector('.heading');
    expect(heading?.textContent).toBe('<b>Remote failed</b>');
    expect(heading?.querySelector('b')).toBeNull();
  });

  it('omits the heading element when no heading is set', async () => {
    const el = await mount('mf-alert');
    expect(shadow(el).querySelector('.heading')).toBeNull();
  });
});
