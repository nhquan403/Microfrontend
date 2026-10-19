import { css, html, LitElement } from 'lit';
import { baseStyles } from './shared-styles';

/** Page footer; content is provided through the default slot. */
export class MfAppFooter extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      footer {
        padding: var(--mf-space-md) var(--mf-space-lg);
        background: var(--mf-color-surface);
        color: var(--mf-color-text-muted);
        border-top: 1px solid var(--mf-color-border);
        font-size: var(--mf-font-size-sm);
      }
    `,
  ];

  protected override render() {
    return html`<footer part="footer"><slot></slot></footer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mf-app-footer': MfAppFooter;
  }
}
