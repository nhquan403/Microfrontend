import { mount, shadow } from '../test-utils';

describe('mf-spinner', () => {
  it('renders role="status" with an accessible default label', async () => {
    const el = await mount('mf-spinner');
    const status = shadow(el).querySelector('[role="status"]');
    expect(status?.textContent?.trim()).toBe('Loading');
    expect(el.getAttribute('size')).toBe('md');
  });

  it('applies custom label and size', async () => {
    const el = await mount('mf-spinner', (s) => {
      s.label = 'Loading orders';
      s.size = 'lg';
    });
    expect(
      shadow(el).querySelector('[role="status"]')?.textContent?.trim(),
    ).toBe('Loading orders');
    expect(el.getAttribute('size')).toBe('lg');
  });
});
