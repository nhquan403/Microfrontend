import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createApi } from './app';

const issuer = process.env['OIDC_ISSUER'];
if (!issuer)
  throw new Error('Missing required environment variable OIDC_ISSUER');
const audience = process.env['DEMO_API_AUDIENCE'] || 'demo-api';
const port = Number(process.env['DEMO_API_PORT'] || 4100);

const jwks = createRemoteJWKSet(
  new URL(`${issuer}/protocol/openid-connect/certs`),
);

const app = createApi(async (token) => {
  const { payload } = await jwtVerify(token, jwks, { issuer, audience });
  return payload;
});

// Only the BFF on this machine should reach the API.
app.listen(port, '127.0.0.1', () => {
  console.log(
    JSON.stringify({ level: 'info', msg: 'demo-api listening', port }),
  );
});
