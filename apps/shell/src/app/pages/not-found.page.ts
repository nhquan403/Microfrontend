import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';

@Component({
  selector: 'sh-not-found-page',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mf-alert variant="info" data-testid="not-found">
      <h1>Page not found</h1>
      <p>The page you asked for does not exist.</p>
    </mf-alert>
  `,
})
export class NotFoundPage {}
