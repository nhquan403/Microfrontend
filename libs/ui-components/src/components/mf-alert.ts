import { css, html, LitElement, nothing } from 'lit';
import { baseStyles } from './shared-styles';

export type MfAlertVariant = 'info' | 'danger';

/**
 * Inline message box (used e.g. by the remote-load error page).
 * `danger` uses role="alert" (announced immediately), `info` uses role="status".
 */
export class MfAlert extends LitElement {
  static override properties = {
    variant: { reflect: true },
    heading: {},
  };

  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .alert {
        display: flex;
        gap: var(--mf-space-sm);
        padding: var(--mf-space-md);
        border: 1px solid var(--mf-color-border);
        border-left-width: 4px;
        border-radius: var(--mf-radius-md);
        background: var(--mf-color-info-surface);
        color: var(--mf-color-text);
        border-left-color: var(--mf-color-primary);
      }
      :host([variant='danger']) .alert {
        background: var(--mf-color-danger-surface);
        border-left-color: var(--mf-color-danger);
      }
      :host([variant='danger']) mf-icon {
        color: var(--mf-color-danger);
      }
      mf-icon {
        flex: none;
        color: var(--mf-color-primary);
      }
      .heading {
        margin: 0 0 var(--mf-space-xs);
        font-weight: var(--mf-font-weight-bold);
      }
    `,
  ];

  declare variant: MfAlertVariant;
  declare heading: string;

  constructor() {
    super();
    this.variant = 'info';
    this.heading = '';
  }

  protected override render() {
    const danger = this.variant === 'danger';
    return html`<div
      part="alert"
      class="alert"
      role=${danger ? 'alert' : 'status'}
    >
      <mf-icon name=${danger ? 'alert' : 'info'}></mf-icon>
      <div>
        ${this.heading ? html`<p class="heading">${this.heading}</p>` : nothing}
        <slot></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mf-alert': MfAlert;
  }
}
