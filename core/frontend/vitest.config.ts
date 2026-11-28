import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { resolveLabDepsPlugin } from './vite.config';

/** Vitest configuration using jsdom, labs/ dependency resolution, and @/ barrel alias. */
export default defineConfig({
  plugins: [resolveLabDepsPlugin(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testSetup.ts'],
    // Vitest empties CSS imports by default, even `?raw`; token files must stay readable for the
    // design-token SSOT tests (ADR-0012).
    css: { include: [/src[\\/]styles[\\/]tokens[\\/]/] },
    // Node 25+ ships its own global `localStorage` (undefined without --localstorage-file),
    // which shadows jsdom's Storage; turn it off in test workers (ADR-0011).
    pool: 'forks',
    poolOptions: {
      forks: { execArgv: ['--no-experimental-webstorage'] },
    },
  },
});
