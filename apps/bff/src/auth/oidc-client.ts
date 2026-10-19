import * as client from 'openid-client';
import type { BffConfig } from '../config';

export interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresInSeconds?: number;
  claims?: Record<string, unknown>;
}

export interface AuthorizationRequest {
  url: URL;
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** The subset of OIDC operations the BFF needs; implemented with openid-client. */
export interface OidcClient {
  createAuthorizationRequest(
    redirectUri: string,
  ): Promise<AuthorizationRequest>;
  exchangeCode(
    callbackUrl: URL,
    checks: { state: string; nonce: string; codeVerifier: string },
  ): Promise<TokenResult>;
  refresh(refreshToken: string): Promise<TokenResult>;
  endSessionUrl(
    idTokenHint: string | undefined,
    postLogoutRedirectUri: string,
  ): URL;
}

function toTokenResult(
  response: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
): TokenResult {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    idToken: response.id_token,
    expiresInSeconds: response.expiresIn(),
    claims: response.claims() as Record<string, unknown> | undefined,
  };
}

export async function createOidcClient(
  oidc: BffConfig['oidc'],
  options: { allowHttp: boolean },
): Promise<OidcClient> {
  const issuer = new URL(oidc.issuer);
  // The local Keycloak issuer is plain http; only allowed when explicitly requested.
  const allowInsecure = options.allowHttp && issuer.protocol === 'http:';
  const configuration = await client.discovery(
    issuer,
    oidc.clientId,
    undefined,
    client.ClientSecretBasic(oidc.clientSecret),
    {
      execute: [
        // Verify ID token signatures against the issuer JWKS instead of relying on TLS alone.
        client.enableNonRepudiationChecks,
        ...(allowInsecure ? [client.allowInsecureRequests] : []),
      ],
    },
  );

  return {
    async createAuthorizationRequest(redirectUri) {
      const codeVerifier = client.randomPKCECodeVerifier();
      const state = client.randomState();
      const nonce = client.randomNonce();
      const url = client.buildAuthorizationUrl(configuration, {
        redirect_uri: redirectUri,
        scope: 'openid profile email',
        code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        state,
        nonce,
      });
      return { url, state, nonce, codeVerifier };
    },

    async exchangeCode(callbackUrl, checks) {
      const response = await client.authorizationCodeGrant(
        configuration,
        callbackUrl,
        {
          pkceCodeVerifier: checks.codeVerifier,
          expectedState: checks.state,
          expectedNonce: checks.nonce,
          idTokenExpected: true,
        },
      );
      return toTokenResult(response);
    },

    async refresh(refreshToken) {
      return toTokenResult(
        await client.refreshTokenGrant(configuration, refreshToken),
      );
    },

    endSessionUrl(idTokenHint, postLogoutRedirectUri) {
      const params: Record<string, string> = {
        post_logout_redirect_uri: postLogoutRedirectUri,
        client_id: oidc.clientId,
      };
      if (idTokenHint) params['id_token_hint'] = idTokenHint;
      return client.buildEndSessionUrl(configuration, params);
    },
  };
}
