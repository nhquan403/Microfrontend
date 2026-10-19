/**
 * Path of the token stylesheet relative to the workspace root. The shell adds
 * it to its global `styles` so the variables are loaded exactly once per page.
 */
export const tokensCssPath = 'libs/design-tokens/src/tokens.css';

/** Theme values accepted by the `data-theme` attribute on `<html>`. */
export type MfTheme = 'light' | 'dark';

/** Every custom property declared in `tokens.css` under `:root`. */
export const MF_TOKEN_NAMES = [
  '--mf-color-primary',
  '--mf-color-primary-hover',
  '--mf-color-on-primary',
  '--mf-color-surface',
  '--mf-color-surface-muted',
  '--mf-color-on-surface',
  '--mf-color-text',
  '--mf-color-text-muted',
  '--mf-color-border',
  '--mf-color-danger',
  '--mf-color-danger-hover',
  '--mf-color-on-danger',
  '--mf-color-danger-surface',
  '--mf-color-success',
  '--mf-color-on-success',
  '--mf-color-success-surface',
  '--mf-color-info-surface',
  '--mf-color-focus-ring',
  '--mf-space-xs',
  '--mf-space-sm',
  '--mf-space-md',
  '--mf-space-lg',
  '--mf-space-xl',
  '--mf-radius-sm',
  '--mf-radius-md',
  '--mf-radius-lg',
  '--mf-radius-full',
  '--mf-font-family',
  '--mf-font-family-mono',
  '--mf-font-size-sm',
  '--mf-font-size-md',
  '--mf-font-size-lg',
  '--mf-font-weight-regular',
  '--mf-font-weight-bold',
  '--mf-font-line-height',
  '--mf-shadow-sm',
  '--mf-shadow-md',
] as const;

export type MfTokenName = (typeof MF_TOKEN_NAMES)[number];

/** Returns a `var()` reference for a token, e.g. `mfVar('--mf-space-md')`. */
export function mfVar(name: MfTokenName, fallback?: string): string {
  return fallback === undefined ? `var(${name})` : `var(${name}, ${fallback})`;
}
