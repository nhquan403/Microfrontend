import { css, html, LitElement } from 'lit';
import { baseStyles, emit } from './shared-styles';

/**
 * Application header with `brand` and `user` slots plus a logout button.
 * The button only dispatches `mf-logout`; the shell performs the logout.
 */
export class MfAppHeader extends LitElement {
  static override properties = {
    logoutLabel: { attribute: 'logout-label' },
  };

  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      header {
        display: flex;
        align-items: center;
        gap: var(--mf-space-md);
        min-height: 3.5rem;
        padding: var(--mf-space-sm) var(--mf-space-lg);
        background: var(--mf-color-surface);
        color: var(--mf-color-text);
        border-bottom: 1px solid var(--mf-color-border);
        box-shadow: var(--mf-shadow-sm);
      }
      .brand {
        font-size: var(--mf-font-size-lg);
        font-weight: var(--mf-font-weight-bold);
      }
      .spacer {
        flex: 1;
      }
      .user {
        display: flex;
        align-items: center;
        gap: var(--mf-space-sm);
        font-size: var(--mf-font-size-sm);
        color: var(--mf-color-text-muted);
      }
      button {
        padding: var(--mf-space-xs) var(--mf-space-md);
        border: 1px solid var(--mf-color-border);
        border-radius: var(--mf-radius-md);
        background: var(--mf-color-surface);
        color: var(--mf-color-text);
        font: inherit;
        font-size: var(--mf-font-size-sm);
        cursor: pointer;
      }
      button:hover {
        background: var(--mf-color-surface-muted);
      }
    `,
  ];

  declare logoutLabel: string;

  constructor() {
    super();
    this.logoutLabel = 'Log out';
  }

  private onLogout(): void {
    emit(this, 'mf-logout', undefined);
  }

  protected override render() {
    return html`<header part="header">
      <div class="brand"><slot name="brand"></slot></div>
      <div class="spacer"></div>
      <div class="user"><slot name="user"></slot></div>
      <button part="logout" type="button" @click=${this.onLogout}>
        ${this.logoutLabel}
      </button>
    </header>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mf-app-header': MfAppHeader;
  }
  interface HTMLElementEventMap {
    'mf-logout': CustomEvent<undefined>;
  }
}
