import { css, html, LitElement } from 'lit';
import { baseStyles } from './shared-styles';

export type MfButtonVariant = 'primary' | 'secondary' | 'danger';
export type MfButtonType = 'button' | 'submit';

const VARIANTS: readonly MfButtonVariant[] = ['primary', 'secondary', 'danger'];

/**
 * Form-associated button. `type="submit"` submits the owning `<form>` through
 * ElementInternals because a button inside Shadow DOM cannot reach it natively.
 */
export class MfButton extends LitElement {
  static readonly formAssociated = true;

  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override properties = {
    variant: { reflect: true },
    disabled: { type: Boolean, reflect: true },
    type: { reflect: true },
  };

  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--mf-space-xs);
        min-height: 2.25rem;
        padding: var(--mf-space-sm) var(--mf-space-md);
        border: 1px solid transparent;
        border-radius: var(--mf-radius-md);
        font: inherit;
        font-size: var(--mf-font-size-sm);
        font-weight: var(--mf-font-weight-bold);
        cursor: pointer;
        background: var(--mf-color-primary);
        color: var(--mf-color-on-primary);
      }
      button:hover:not(:disabled) {
        background: var(--mf-color-primary-hover);
      }
      :host([variant='secondary']) button {
        background: var(--mf-color-surface);
        color: var(--mf-color-text);
        border-color: var(--mf-color-border);
      }
      :host([variant='secondary']) button:hover:not(:disabled) {
        background: var(--mf-color-surface-muted);
      }
      :host([variant='danger']) button {
        background: var(--mf-color-danger);
        color: var(--mf-color-on-danger);
      }
      :host([variant='danger']) button:hover:not(:disabled) {
        background: var(--mf-color-danger-hover);
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
    `,
  ];

  declare variant: MfButtonVariant;
  declare disabled: boolean;
  declare type: MfButtonType;

  /** Null only in environments without ElementInternals support. */
  readonly internals: ElementInternals | null;

  /** Disabled state inherited from an ancestor `<fieldset disabled>`. */
  private formDisabled = false;

  constructor() {
    super();
    this.variant = 'primary';
    this.disabled = false;
    this.type = 'button';
    this.internals =
      typeof this.attachInternals === 'function'
        ? this.attachInternals()
        : null;
    // Host-level listener so clicks on a disabled button never reach consumers.
    this.addEventListener('click', this.onHostClick, { capture: true });
  }

  /**
   * Owning form. Uses ElementInternals when available (honours the `form`
   * attribute); falls back to the nearest ancestor form in engines without it.
   */
  get form(): HTMLFormElement | null {
    if (this.internals) return this.internals.form;
    return this.closest('form');
  }

  /** Called by the browser when an ancestor fieldset toggles `disabled`. */
  formDisabledCallback(disabled: boolean): void {
    this.formDisabled = disabled;
    this.requestUpdate();
  }

  private get isDisabled(): boolean {
    return this.disabled || this.formDisabled;
  }

  private readonly onHostClick = (event: Event): void => {
    if (this.isDisabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  private onInnerClick(): void {
    if (this.isDisabled || this.type !== 'submit') return;
    const form = this.form;
    if (!form) return;
    // requestSubmit runs constraint validation and fires `submit`, like a native submit button.
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.submit();
  }

  protected override render() {
    const variant = VARIANTS.includes(this.variant) ? this.variant : 'primary';
    return html`<button
      part="button"
      class=${variant}
      type="button"
      ?disabled=${this.isDisabled}
      aria-disabled=${this.isDisabled ? 'true' : 'false'}
      @click=${this.onInnerClick}
    >
      <slot></slot>
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mf-button': MfButton;
  }
}
