import { css, html, LitElement, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { baseStyles, emit } from './shared-styles';

export interface MfSidebarItem {
  /** Stable identifier, e.g. the remote name. */
  name: string;
  /** Visible label. */
  title: string;
  /** App-relative route starting with a single `/`. */
  route: string;
  /** Optional built-in icon name (see `mf-icon`). */
  icon?: string;
}

export interface MfNavigateDetail {
  route: string;
}

/**
 * Only app-relative paths are rendered as links. This blocks `javascript:`
 * URLs and protocol-relative `//host` links if the item list comes from a
 * remote manifest.
 */
export function isSafeRoute(route: unknown): route is string {
  return (
    typeof route === 'string' &&
    route.startsWith('/') &&
    !route.startsWith('//')
  );
}

/**
 * Navigation list. It never navigates by itself: a plain click is prevented
 * and re-emitted as `mf-navigate` so the shell router stays in control.
 * Modified clicks (Ctrl/Cmd/Shift/middle button) keep native behaviour so
 * "open in new tab" still works.
 */
export class MfSidebar extends LitElement {
  static override properties = {
    items: { attribute: false },
    active: {},
    label: {},
  };

  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      nav {
        height: 100%;
        padding: var(--mf-space-md) var(--mf-space-sm);
        background: var(--mf-color-surface-muted);
        border-right: 1px solid var(--mf-color-border);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--mf-space-xs);
      }
      a {
        display: flex;
        align-items: center;
        gap: var(--mf-space-sm);
        padding: var(--mf-space-sm) var(--mf-space-md);
        border-radius: var(--mf-radius-md);
        color: var(--mf-color-text);
        font-size: var(--mf-font-size-sm);
        text-decoration: none;
      }
      a:hover {
        background: var(--mf-color-surface);
      }
      a[aria-current='page'] {
        background: var(--mf-color-primary);
        color: var(--mf-color-on-primary);
        font-weight: var(--mf-font-weight-bold);
      }
    `,
  ];

  declare items: MfSidebarItem[];
  declare active: string;
  declare label: string;

  constructor() {
    super();
    this.items = [];
    this.active = '';
    this.label = 'Main navigation';
  }

  /** Exact match, or a nested route below the item (`/orders` matches `/orders/42`). */
  isActive(route: string): boolean {
    if (!this.active) return false;
    if (this.active === route) return true;
    return route !== '/' && this.active.startsWith(`${route}/`);
  }

  private onLinkClick(event: MouseEvent, item: MfSidebarItem): void {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    emit<MfNavigateDetail>(this, 'mf-navigate', { route: item.route });
  }

  protected override render() {
    const items = Array.isArray(this.items)
      ? this.items.filter((item) => item && isSafeRoute(item.route))
      : [];
    return html`<nav part="nav" aria-label=${this.label}>
      <ul>
        ${repeat(
          items,
          (item) => item.name,
          (item) =>
            html`<li>
              <a
                part="link"
                href=${item.route}
                aria-current=${this.isActive(item.route) ? 'page' : nothing}
                @click=${(event: MouseEvent) => this.onLinkClick(event, item)}
              >
                ${item.icon
                  ? html`<mf-icon name=${item.icon}></mf-icon>`
                  : nothing}
                <span>${item.title}</span>
              </a>
            </li>`,
        )}
      </ul>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mf-sidebar': MfSidebar;
  }
  interface HTMLElementEventMap {
    'mf-navigate': CustomEvent<MfNavigateDetail>;
  }
}
