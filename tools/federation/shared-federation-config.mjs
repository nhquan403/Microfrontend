// Sharing rules used by the shell and every remote. One copy keeps versions in lockstep:
// all apps share Angular, rxjs and Lit as strict singletons, plus the @mf/* workspace libs.
import {
  fromPackageJson,
  mappingsFromWorkspace,
} from '@angular-architects/native-federation/config';

/** Root package.json dependencies that only run in the BFF or the build, never in the browser. */
const SERVER_ONLY = [
  'express',
  'express-session',
  'express-rate-limit',
  'helmet',
  'http-proxy-middleware',
  'jose',
  'openid-client',
  'es-module-shims',
];

export function sharedFederationConfig() {
  return {
    shared: fromPackageJson({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
      build: 'package',
    })
      .patch(['@angular/*'], { includeSecondaries: { keepAll: true } })
      .get(),

    sharedMappings: mappingsFromWorkspace({ singleton: true })
      .filter(['@mf/*'])
      .get(),

    skip: [
      ...SERVER_ONLY,
      'rxjs/ajax',
      'rxjs/fetch',
      'rxjs/testing',
      'rxjs/webSocket',
      // @angular/animations is not installed; these secondaries would pull it in.
      '@angular/platform-browser/animations',
      '@angular/platform-browser/animations/async',
    ],

    features: {
      denseChunking: true,
      denseExternals: true,
      strictImports: false,
    },
  };
}
