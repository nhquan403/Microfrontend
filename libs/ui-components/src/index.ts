import { MfAlert } from './components/mf-alert';
import { MfAppFooter } from './components/mf-app-footer';
import { MfAppHeader } from './components/mf-app-header';
import { MfButton } from './components/mf-button';
import { MfIcon } from './components/mf-icon';
import { MfSidebar } from './components/mf-sidebar';
import { MfSpinner } from './components/mf-spinner';

export {
  MfAlert,
  MfAppFooter,
  MfAppHeader,
  MfButton,
  MfIcon,
  MfSidebar,
  MfSpinner,
};
export type { MfAlertVariant } from './components/mf-alert';
export type { MfButtonType, MfButtonVariant } from './components/mf-button';
export { MF_ICON_NAMES, type MfIconName } from './components/mf-icon';
export {
  isSafeRoute,
  type MfNavigateDetail,
  type MfSidebarItem,
} from './components/mf-sidebar';
export type { MfSpinnerSize } from './components/mf-spinner';

/** Tag name to class mapping for every component in the library. */
export const MF_COMPONENTS = {
  'mf-button': MfButton,
  'mf-icon': MfIcon,
  'mf-app-header': MfAppHeader,
  'mf-sidebar': MfSidebar,
  'mf-app-footer': MfAppFooter,
  'mf-alert': MfAlert,
  'mf-spinner': MfSpinner,
} as const satisfies Record<`mf-${string}`, CustomElementConstructor>;

export type MfTagName = keyof typeof MF_COMPONENTS;

/**
 * Registers every mf-* element. Importing this module has no side effects;
 * the shell calls this once. Already-registered tags are skipped, so repeated
 * calls (or a remote calling it too) never throw.
 */
export function defineMfComponents(
  registry: CustomElementRegistry = customElements,
): void {
  for (const [tag, ctor] of Object.entries(MF_COMPONENTS)) {
    if (!registry.get(tag)) {
      registry.define(tag, ctor);
    }
  }
}
