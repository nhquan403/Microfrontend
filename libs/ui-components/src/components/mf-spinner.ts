import { css, html, LitElement } from 'lit';

export type MfSpinnerSize = 'sm' | 'md' | 'lg';

/** Loading indicator announced to assistive technology through role="status". */
export class MfSpinner extends LitElement {
  static override properties = {
    label: {},
    size: { reflect: true },
  };

  static override styles = css`
    :host {
      display: inline-flex;
      --_size: 1.5rem;
    }
    :host([size='sm']) {
      --_size: 1rem;
    }
    :host([size='lg']) {
      --_size: 2.5rem;
    }
    .spinner {
      width: var(--_size);
      height: var(--_size);
      border: 3px solid var(--mf-color-border);
      border-top-color: var(--mf-color-primary);
      border-radius: var(--mf-radius-full);
      animation: spin 0.8s linear infinite;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 2.4s;
      }
    }
  `;

  declare label: string;
  declare size: MfSpinnerSize;

  constructor() {
    super();
    this.label = 'Loading';
    this.size = 'md';
  }

  protected override render() {
    return html`<div part="spinner" role="status">
      <div class="spinner" aria-hidden="true"></div>
      <span class="sr-only">${this.label}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mf-spinner': MfSpinner;
  }
}
