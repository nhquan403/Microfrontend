import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AuthService, REGISTRY_ITEMS } from '@mf/shell-auth';
import type { MfNavigateDetail, MfSidebarItem } from '@mf/ui-components';
import { filter, map } from 'rxjs';

@Component({
  selector: 'sh-root',
  imports: [RouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly year = new Date().getFullYear();

  protected readonly sidebarItems: MfSidebarItem[] = [
    { name: 'home', title: 'Home', route: '/', icon: 'home' },
    ...inject(REGISTRY_ITEMS).map((item) => ({
      name: item.name,
      title: item.title,
      route: `/${item.route}`,
      icon: item.icon,
    })),
  ];

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activeRoute = computed(() => this.url().split(/[?#]/)[0]);

  protected navigate(event: Event): void {
    const { route } = (event as CustomEvent<MfNavigateDetail>).detail;
    void this.router.navigateByUrl(route);
  }

  protected logout(): void {
    this.auth.logout().catch((error) => console.error('Logout failed', error));
  }
}
