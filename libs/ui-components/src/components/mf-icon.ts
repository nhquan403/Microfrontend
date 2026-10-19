import {
  css,
  html,
  LitElement,
  nothing,
  svg,
  type SVGTemplateResult,
} from 'lit';

/** Built-in icon set; paths are bundled so no network request is ever made. */
const ICONS = {
  home: svg`<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>`,
  menu: svg`<path d="M4 6h16M4 12h16M4 18h16"/>`,
  user: svg`<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>`,
  logout: svg`<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>`,
  settings: svg`<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>`,
  grid: svg`<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>`,
  info: svg`<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>`,
  alert: svg`<path d="M12 3l10 18H2z"/><path d="M12 10v4"/><path d="M12 17h.01"/>`,
  check: svg`<path d="M5 12l5 5 9-10"/>`,
  close: svg`<path d="M6 6l12 12M18 6L6 18"/>`,
  'chevron-right': svg`<path d="M9 6l6 6-6 6"/>`,
} satisfies Record<string, SVGTemplateResult>;

export type MfIconName = keyof typeof ICONS;

export const MF_ICON_NAMES = Object.keys(ICONS) as MfIconName[];

function isIconName(name: string): name is MfIconName {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

/**
 * Inline SVG icon. Decorative by default (aria-hidden); set `label` to expose
 * it to assistive technology as role="img".
 */
export class MfIcon extends LitElement {
  static override properties = {
    name: { reflect: true },
    label: {},
  };

  static override styles = css`
    :host {
      display: inline-flex;
      width: var(--mf-icon-size, 1.25em);
      height: var(--mf-icon-size, 1.25em);
      color: inherit;
      vertical-align: middle;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `;

  declare name: string;
  declare label: string;

  constructor() {
    super();
    this.name = '';
    this.label = '';
  }

  protected override render() {
    if (!isIconName(this.name)) return nothing;
    const labelled = this.label.trim().length > 0;
    return html`<svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
      role=${labelled ? 'img' : nothing}
      aria-label=${labelled ? this.label : nothing}
      aria-hidden=${labelled ? nothing : 'true'}
    >
      ${ICONS[this.name]}
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mf-icon': MfIcon;
  }
}
