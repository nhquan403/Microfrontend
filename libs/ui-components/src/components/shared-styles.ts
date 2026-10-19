import { css } from 'lit';

/** Base host reset and the visible keyboard focus ring shared by every mf-* component. */
export const baseStyles = css`
  :host {
    box-sizing: border-box;
    font-family: var(--mf-font-family);
    line-height: var(--mf-font-line-height);
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  :focus-visible {
    outline: 2px solid var(--mf-color-focus-ring);
    outline-offset: 2px;
  }
`;

/** Dispatches a `bubbles + composed` CustomEvent so it crosses Shadow DOM boundaries. */
export function emit<T>(target: EventTarget, type: string, detail: T): boolean {
  return target.dispatchEvent(
    new CustomEvent<T>(type, {
      detail,
      bubbles: true,
      composed: true,
      cancelable: true,
    }),
  );
}
