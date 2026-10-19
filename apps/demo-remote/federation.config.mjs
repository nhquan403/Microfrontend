import { withNativeFederation } from '@angular-architects/native-federation/config';
import { sharedFederationConfig } from '../../tools/federation/shared-federation-config.mjs';

// Remote contract: expose `./routes` (Angular Routes) and nothing else. See docs/remote-contract.md.
export default withNativeFederation({
  name: 'demo',
  exposes: {
    './routes': './apps/demo-remote/src/app/remote.routes.ts',
  },
  ...sharedFederationConfig(),
});
