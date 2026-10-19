export function hasAllRoles(
  userRoles: readonly string[],
  required: readonly string[],
): boolean {
  return required.every((role) => userRoles.includes(role));
}

/** Reads realm roles from the `roles` claim added by the Keycloak realm-roles mapper. */
export function rolesFromClaims(
  claims: Record<string, unknown> | undefined,
): string[] {
  const roles = claims?.['roles'];
  return Array.isArray(roles)
    ? roles.filter((r): r is string => typeof r === 'string')
    : [];
}
