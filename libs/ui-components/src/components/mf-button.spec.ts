import { MfButton } from './mf-button';
import { mount, shadow } from '../test-utils';

function inner(el: Element): HTMLButtonElement {
  const button = shadow(el).querySelector('button');
  if (!button) throw new Error('inner button missing');
  return button;
}

describe('mf-button', () => {
  it('renders slotted label with primary/button defaults', async () => {
    const el = await mount('mf-button', (b) => (b.textContent = 'Save'));
    expect(el.variant).toBe('primary');
    expect(el.type).toBe('button');
    expect(el.getAttribute('variant')).toBe('primary');
    expect(shadow(el).querySelector('slot')).not.toBeNull();
    expect(inner(el).getAttribute('type')).toBe('button');
  });

  it('reflects variant and disabled', async () => {
    const el = await mount('mf-button', (b) => {
      b.variant = 'danger';
      b.disabled = true;
    });
    expect(el.getAttribute('variant')).toBe('danger');
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(inner(el).disabled).toBe(true);
    expect(inner(el).getAttribute('aria-disabled')).toBe('true');
  });

  it('falls back to primary styling class for an unknown variant', async () => {
    const el = await mount('mf-button', (b) => {
      b.setAttribute('variant', 'bogus');
    });
    expect(inner(el).className).toBe('primary');
  });

  it('suppresses click events while disabled', async () => {
    const el = await mount('mf-button', (b) => (b.disabled = true));
    const listener = vi.fn();
    el.addEventListener('click', listener);
    el.click();
    expect(listener).not.toHaveBeenCalled();
  });

  it('is form-associated', () => {
    expect(customElements.get('mf-button')).toHaveProperty(
      'formAssociated',
      true,
    );
  });

  it('type="submit" submits the ancestor form (no ElementInternals fallback)', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const el = await mount('mf-button', (b) => (b.type = 'submit'), form);
    expect(el.form).toBe(form);

    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener('submit', onSubmit);
    inner(el).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('type="submit" uses the form resolved by ElementInternals when supported', async () => {
    // happy-dom has no attachInternals; emulate a browser that resolves the
    // owner form through ElementInternals (e.g. via the form="" attribute).
    const ownerForm = document.createElement('form');
    document.body.appendChild(ownerForm);
    const proto = HTMLElement.prototype as Partial<HTMLElement>;
    const original = proto.attachInternals;
    proto.attachInternals = () =>
      ({ form: ownerForm }) as unknown as ElementInternals;
    try {
      const el = new MfButton();
      el.type = 'submit';
      document.body.appendChild(el);
      await el.updateComplete;
      expect(el.internals).not.toBeNull();
      expect(el.form).toBe(ownerForm);

      const onSubmit = vi.fn((event: Event) => event.preventDefault());
      ownerForm.addEventListener('submit', onSubmit);
      inner(el).click();
      expect(onSubmit).toHaveBeenCalledTimes(1);
    } finally {
      if (original) proto.attachInternals = original;
      else delete proto.attachInternals;
    }
  });

  it('type="button" does not submit the form', async () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const el = await mount('mf-button', undefined, form);
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener('submit', onSubmit);
    inner(el).click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables itself when an ancestor fieldset is disabled', async () => {
    const el = await mount('mf-button');
    el.formDisabledCallback(true);
    await el.updateComplete;
    expect(inner(el).disabled).toBe(true);
  });
});
