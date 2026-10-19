import type { LitElement } from 'lit';
import { defineMfComponents, type MfTagName } from './index';

/** Registers the components, mounts `tag` in the document and waits for its first render. */
export async function mount<K extends MfTagName>(
  tag: K,
  setup?: (el: HTMLElementTagNameMap[K]) => void,
  parent: HTMLElement = document.body,
): Promise<HTMLElementTagNameMap[K]> {
  defineMfComponents();
  const el = document.createElement(tag) as HTMLElementTagNameMap[K];
  setup?.(el);
  parent.appendChild(el);
  await (el as LitElement).updateComplete;
  return el;
}

export function shadow(el: Element): ShadowRoot {
  if (!el.shadowRoot)
    throw new Error(`${el.localName} has no open shadow root`);
  return el.shadowRoot;
}

afterEach(() => {
  document.body.replaceChildren();
});
