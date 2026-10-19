import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService, NAVIGATE_TO } from './auth.service';
import { CURRENT_USER } from './current-user';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const navigations: string[] = [];

  beforeEach(() => {
    navigations.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CURRENT_USER,
          useValue: {
            sub: 'u1',
            name: 'Alice',
            roles: ['shell-user', 'demo-access'],
          },
        },
      ],
    });
    service = TestBed.inject(AuthService);
    service[NAVIGATE_TO] = (url: string) => navigations.push(url);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('exposes the user and answers role checks', () => {
    expect(service.user().name).toBe('Alice');
    expect(service.hasRoles('demo-access')).toBe(true);
    expect(service.hasRoles('demo-access', 'admin')).toBe(false);
  });

  it('never exposes token material', () => {
    expect(JSON.stringify(service.user())).not.toMatch(/token/i);
  });

  it('posts to /auth/logout and follows the identity provider logout URL', async () => {
    const done = service.logout();
    const req = http.expectOne('/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush({
      logoutUrl:
        'http://localhost:8080/realms/x/logout?post_logout_redirect_uri=y',
    });
    await done;
    expect(navigations).toEqual([
      'http://localhost:8080/realms/x/logout?post_logout_redirect_uri=y',
    ]);
  });

  it('refuses a non-http logout URL', async () => {
    const done = service.logout();
    http.expectOne('/auth/logout').flush({ logoutUrl: 'javascript:alert(1)' });
    await expect(done).rejects.toThrow('Unexpected logout URL');
    expect(navigations).toEqual([]);
  });
});
