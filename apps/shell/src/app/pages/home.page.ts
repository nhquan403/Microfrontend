import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService, REGISTRY_ITEMS } from '@mf/shell-auth';

@Component({
  selector: 'sh-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Welcome, {{ auth.user().name }}</h1>
    @if (items.length) {
      <p>Pick an application from the sidebar.</p>
    } @else {
      <p data-testid="no-apps">
        No applications are available for your account yet.
      </p>
    }
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  protected readonly items = inject(REGISTRY_ITEMS);
}
