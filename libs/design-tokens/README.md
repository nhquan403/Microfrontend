# design-tokens

CSS custom properties shared by the shell, every remote and the `mf-*` Web Components
(`@mf/ui-components`). The stylesheet is `src/tokens.css`; the shell loads it once,
globally. Remotes and components only read the variables, they never redefine them.

## Naming conventions

- Format: `--mf-<category>-<role>[-<variant>]`, lowercase kebab-case.
- `--mf-` prefix is mandatory so tokens never collide with third-party variables.
- Categories: `color`, `space`, `radius`, `font`, `shadow`. Add a new category only
  when none of these fits.
- Colors are named by role, never by hue: `--mf-color-danger`, not `--mf-color-red`.
- Every fill color has an `on-*` partner for text/icons drawn on top of it
  (`--mf-color-primary` + `--mf-color-on-primary`). `*-surface` variants are soft
  backgrounds for alerts and badges; `*-hover` variants are interaction states.
- Scales use t-shirt sizes: `xs`, `sm`, `md`, `lg`, `xl` (`full` for pill radius).
- Theming: `:root` holds the light theme; `[data-theme='dark']` overrides color and
  shadow tokens only. Set `data-theme="dark"` on `<html>` (or any subtree).
- Components consume tokens with `var(--mf-...)` only; hard-coded colors are not
  allowed outside `tokens.css`.
- When adding or renaming a token, update `MF_TOKEN_NAMES` in `src/index.ts`; the unit
  test fails if the list and the stylesheet drift apart.

## TypeScript helpers

- `tokensCssPath`: workspace-relative path of the stylesheet.
- `MF_TOKEN_NAMES` / `MfTokenName`: typed list of every token.
- `mfVar(name, fallback?)`: builds a `var()` reference.

## Review page

Open `demo/index.html` in a browser to review light and dark palettes side by side.

## Running unit tests

Run `nx test design-tokens` to execute the unit tests via [Vitest](https://vitest.dev/).
