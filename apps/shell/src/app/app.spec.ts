import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CURRENT_USER, REGISTRY_ITEMS } from '@mf/shell-auth';
import { App } from './app';

describe('App shell layout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: CURRENT_USER,
          useValue: { sub: 'u', name: 'Alice Demo', roles: [] },
        },
        {
          provide: REGISTRY_ITEMS,
          useValue: [
            {
              name: 'demo',
              title: 'Demo',
              route: 'demo',
              exposedModule: './routes',
              requiredRoles: [],
            },
          ],
        },
      ],
    }).compileComponents();
  });

  it('renders header, sidebar, content outlet and footer', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(
      el.querySelector('[data-testid="user-name"]')?.textContent,
    ).toContain('Alice Demo');
    expect(el.querySelector('mf-app-header')).not.toBeNull();
    expect(el.querySelector('main router-outlet')).not.toBeNull();
    expect(el.querySelector('mf-app-footer')).not.toBeNull();
    const sidebar = el.querySelector('mf-sidebar') as HTMLElement & {
      items: { route: string }[];
    };
    expect(sidebar.items.map((i) => i.route)).toEqual(['/', '/demo']);
  });

  it('navigates when the sidebar emits mf-navigate', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.nativeElement
      .querySelector('mf-sidebar')
      .dispatchEvent(
        new CustomEvent('mf-navigate', { detail: { route: '/demo' } }),
      );
    expect(spy).toHaveBeenCalledWith('/demo');
  });
});
