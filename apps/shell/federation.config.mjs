import { withNativeFederation } from '@angular-architects/native-federation/config';
import { sharedFederationConfig } from '../../tools/federation/shared-federation-config.mjs';

// The shell is a dynamic host: remote URLs come from the BFF `/registry` at runtime.
export default withNativeFederation({
  name: 'shell',
  ...sharedFederationConfig(),
});
