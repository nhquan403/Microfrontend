import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, type Route } from '@angular/router';
import { CURRENT_USER } from './current-user';
import { roleGuard } from './role.guard';

function run(roles: string[], required: string[]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      { provide: CURRENT_USER, useValue: { sub: 'u', name: 'U', roles } },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    roleGuard(required)({} as Route, [], {} as never),
  );
}

describe('roleGuard', () => {
  it('lets users with every required role through', () => {
    expect(run(['shell-user', 'demo-access'], ['demo-access'])).toBe(true);
  });

  it('sends users without the role to /forbidden', () => {
    const result = run(['shell-user'], ['demo-access']);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/forbidden',
    );
  });
});
