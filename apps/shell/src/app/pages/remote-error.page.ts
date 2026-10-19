import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
} from '@angular/core';

/** Where "Try again" goes; a full reload re-initialises federation with a fresh registry. */
export const RELOAD = { page: () => window.location.reload() };

@Component({
  selector: 'sh-remote-error-page',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mf-alert variant="danger" data-testid="remote-error">
      <h1>{{ remoteTitle() }} is unavailable</h1>
      <p>
        The application could not be loaded. The rest of the portal still works.
      </p>
      <mf-button data-testid="remote-retry" (click)="retry()"
        >Try again</mf-button
      >
    </mf-alert>
  `,
})
export class RemoteErrorPage {
  /** From route data (component input binding is enabled in the shell). */
  readonly remoteTitle = input('This application');

  protected retry(): void {
    RELOAD.page();
  }
}
