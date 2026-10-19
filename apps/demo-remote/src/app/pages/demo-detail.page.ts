import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DemoApiService } from '../demo-api.service';

@Component({
  selector: 'demo-detail-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="../..">Back to demo</a>
    @if (item(); as current) {
      <h1 data-testid="detail-title">{{ current.name }}</h1>
      <p>{{ current.description }}</p>
    } @else {
      <p>Item not found.</p>
    }
  `,
})
export class DemoDetailPage {
  /** Bound from the `:id` route parameter (the shell enables component input binding). */
  readonly id = input.required<string>();

  private readonly hello = toSignal(
    inject(DemoApiService)
      .hello()
      .pipe(catchError(() => of(undefined))),
  );

  protected readonly item = computed(() =>
    this.hello()?.items.find((i) => i.id === this.id()),
  );
}
