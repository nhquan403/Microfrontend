import { hasAllRoles } from './current-user';

describe('hasAllRoles', () => {
  const user = { roles: ['shell-user', 'demo-access'] };

  it('allows when no role is required', () => {
    expect(hasAllRoles(user, [])).toBe(true);
  });

  it('allows when every required role is present', () => {
    expect(hasAllRoles(user, ['shell-user', 'demo-access'])).toBe(true);
  });

  it('denies when any required role is missing', () => {
    expect(hasAllRoles(user, ['demo-access', 'admin'])).toBe(false);
  });
});
