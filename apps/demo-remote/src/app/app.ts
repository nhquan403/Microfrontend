import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Shown only when the remote is opened on its own dev server. The remote depends on the
 * shell for sign-in, the design system and API access, so it must run through the BFF.
 */
@Component({
  selector: 'demo-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Demo remote</h1>
    <p>
      This micro frontend runs inside the shell. Open
      <a href="http://localhost:4000/demo">http://localhost:4000/demo</a>
      instead.
    </p>
  `,
})
export class App {}
