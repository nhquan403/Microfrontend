import { createApp } from './app';
import { createOidcClient } from './auth/oidc-client';
import { TokenProvider } from './auth/token-refresh';
import { loadConfig } from './config';
import { gatewayRoutes } from './gateway/gateway-routes';
import { logger } from './logging/logger';
import { loadRegistry } from './registry/registry';
import { MemorySessionStore } from './session/memory-session-store';

async function main(): Promise<void> {
  const config = loadConfig();
  const oidc = await createOidcClient(config.oidc, {
    allowHttp: !config.production,
  });
  const store = new MemorySessionStore();
  if (config.production) {
    logger.warn(
      'using in-memory session store; configure a shared store before scaling out',
    );
  }

  const routes = gatewayRoutes({
    mode: config.serveMode,
    registry: loadRegistry(config.registryFile),
    tokens: new TokenProvider(oidc),
    apiUpstreamUrl: config.apiUpstreamUrl,
    shellDevUrl: config.shellDevUrl,
    shellStaticDir: config.shellStaticDir,
  });
  const app = createApp({ config, oidc, store, routes });
  app.listen(config.port, () => {
    logger.info('bff listening', {
      port: config.port,
      origin: config.publicOrigin,
      mode: config.serveMode,
    });
  });
}

main().catch((error) => {
  logger.error('bff failed to start', { error });
  process.exit(1);
});
