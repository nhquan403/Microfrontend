import { createApp } from './app';
import { createOidcClient } from './auth/oidc-client';
import { loadConfig } from './config';
import { logger } from './logging/logger';
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

  const app = createApp({ config, oidc, store });
  app.listen(config.port, () => {
    logger.info('bff listening', {
      port: config.port,
      origin: config.publicOrigin,
    });
  });
}

main().catch((error) => {
  logger.error('bff failed to start', { error });
  process.exit(1);
});
