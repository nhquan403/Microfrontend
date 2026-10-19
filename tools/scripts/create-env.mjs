// Creates a local .env from .env.example, filling every secret with a fresh random value.
// Usage: node tools/scripts/create-env.mjs [--force]
// Values are written to disk only; nothing secret is printed.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const target = resolve(root, '.env');
if (existsSync(target) && !process.argv.includes('--force')) {
  console.log('.env already exists; pass --force to regenerate it.');
  process.exit(0);
}

const random = (bytes) => randomBytes(bytes).toString('base64url');
const generated = {
  KEYCLOAK_ADMIN: 'admin',
  KEYCLOAK_ADMIN_PASSWORD: random(18),
  OIDC_CLIENT_SECRET: random(32),
  SESSION_SECRET: random(48),
  E2E_ALICE_PASSWORD: random(18),
  E2E_BOB_PASSWORD: random(18),
};

const template = readFileSync(resolve(root, '.env.example'), 'utf8');
const content = template.replace(/^(\w+)=$/gm, (line, key) =>
  key in generated ? `${key}=${generated[key]}` : line,
);
writeFileSync(target, content, { mode: 0o600 });
console.log(
  `Wrote .env with ${Object.keys(generated).length} generated values.`,
);
