import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';

@Component({
  selector: 'sh-forbidden-page',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mf-alert variant="danger" data-testid="forbidden">
      <h1>Access denied</h1>
      <p>Your account does not have permission to open this application.</p>
    </mf-alert>
  `,
})
export class ForbiddenPage {}
