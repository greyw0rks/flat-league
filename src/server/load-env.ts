import * as nextEnv from '@next/env';

// Node ESM exposes this CommonJS package through default; Next's bundler
// exposes its named members. Support both entry points for scripts and routes.
const env = nextEnv as unknown as {
  loadEnvConfig?: typeof import('@next/env').loadEnvConfig;
  default?: { loadEnvConfig: typeof import('@next/env').loadEnvConfig };
};
const load = env.loadEnvConfig ?? env.default?.loadEnvConfig;
if (!load) throw new Error('Next environment loader is unavailable.');
load(process.cwd());
