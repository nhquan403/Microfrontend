import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CURRENT_USER } from '@mf/shell-auth';
import { DemoHomePage } from './demo-home.page';

describe('DemoHomePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DemoHomePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CURRENT_USER,
          useValue: { sub: 'u', name: 'Alice Demo', roles: ['demo-access'] },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render() {
    const fixture = TestBed.createComponent(DemoHomePage);
    await fixture.whenStable();
    return fixture;
  }

  it('uses the shell user and lists items from the API', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    expect(
      el.querySelector('[data-testid="demo-user"]')?.textContent,
    ).toContain('Alice Demo');
    http.expectOne('/api/hello').flush({
      message: 'Hello from demo-api',
      subject: 'u',
      items: [{ id: 'alpha', name: 'Alpha', description: 'd' }],
    });
    await fixture.whenStable();
    expect(
      el.querySelector('[data-testid="api-message"]')?.textContent,
    ).toContain('Hello from demo-api');
    expect(el.querySelectorAll('[data-testid="demo-items"] li').length).toBe(1);
  });

  it('shows an error when the API fails', async () => {
    const fixture = await render();
    http
      .expectOne('/api/hello')
      .flush({ error: 'x' }, { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not load items',
    );
  });

  it('posts the message to /api/echo and shows the result', async () => {
    const fixture = await render();
    http
      .expectOne('/api/hello')
      .flush({ message: 'm', subject: 'u', items: [] });
    const form = (fixture.nativeElement as HTMLElement).querySelector('form');
    form?.dispatchEvent(new Event('submit'));
    const req = http.expectOne('/api/echo');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'hello from the demo remote' });
    req.flush({
      echoed: { message: 'hello from the demo remote' },
      receivedAt: 'now',
    });
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="echo-result"]',
      )?.textContent,
    ).toContain('hello from the demo remote');
  });
});
