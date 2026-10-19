import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '@mf/shell-auth';
import { catchError, map, of } from 'rxjs';
import {
  DemoApiService,
  type DemoItem,
  type EchoResponse,
} from '../demo-api.service';

type HelloState =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; message: string; items: DemoItem[] };

@Component({
  selector: 'demo-home-page',
  imports: [RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 data-testid="demo-title">Demo remote</h1>
    <p data-testid="demo-user">Signed in as {{ auth.user().name }}</p>

    @switch (hello().state) {
      @case ('loading') {
        <mf-spinner label="Loading items"></mf-spinner>
      }
      @case ('error') {
        <mf-alert variant="danger">Could not load items from the API.</mf-alert>
      }
      @case ('ready') {
        @let ready = readyState();
        <p data-testid="api-message">{{ ready?.message }}</p>
        <ul data-testid="demo-items">
          @for (item of ready?.items ?? []; track item.id) {
            <li>
              <a [routerLink]="['items', item.id]">{{ item.name }}</a>
            </li>
          }
        </ul>
      }
    }

    <form (submit)="send($event)">
      <label for="echo-message">Message</label>
      <input
        id="echo-message"
        name="message"
        [value]="message()"
        (input)="onInput($event)"
      />
      <mf-button type="submit" data-testid="echo-submit">Send to API</mf-button>
    </form>
    @if (echo(); as result) {
      <p data-testid="echo-result">API received: {{ result.echoed }}</p>
    }
    @if (echoError()) {
      <mf-alert variant="danger" data-testid="echo-error"
        >The API rejected the request.</mf-alert
      >
    }
  `,
})
export class DemoHomePage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(DemoApiService);

  protected readonly hello = toSignal<HelloState, HelloState>(
    this.api.hello().pipe(
      map(
        (res): HelloState => ({
          state: 'ready',
          message: res.message,
          items: res.items,
        }),
      ),
      catchError(() => of<HelloState>({ state: 'error' })),
    ),
    { initialValue: { state: 'loading' } },
  );

  protected readonly readyState = computed(() => {
    const value = this.hello();
    return value.state === 'ready' ? value : undefined;
  });

  protected readonly message = signal('hello from the demo remote');
  protected readonly echo = signal<{ echoed: unknown } | undefined>(undefined);
  protected readonly echoError = signal(false);

  protected onInput(event: Event): void {
    this.message.set((event.target as HTMLInputElement).value);
  }

  protected send(event: Event): void {
    event.preventDefault();
    this.echoError.set(false);
    this.api.echo(this.message()).subscribe({
      next: (res: EchoResponse) =>
        this.echo.set({
          echoed: (res.echoed as { message?: string })?.message,
        }),
      error: () => this.echoError.set(true),
    });
  }
}
