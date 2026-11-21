import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const FRONTEND_ENTRY = path.resolve(__dirname, 'src/main.tsx');
const LABS_DIR_PREFIX = `${path.resolve(__dirname, '../../labs').replaceAll('\\', '/')}/`;
const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[\\/]/;

function isBareSpecifier(source: string): boolean {
  return !(
    source.startsWith('.') ||
    source.startsWith('/') ||
    source.startsWith('@/') ||
    source.startsWith('\0') ||
    source.startsWith('node:') ||
    source.startsWith('virtual:') ||
    path.isAbsolute(source) ||
    WINDOWS_DRIVE_RE.test(source)
  );
}

/**
 * Resolve bare npm imports inside repo-root labs/ against core/frontend/node_modules.
 *
 * @returns Vite plugin redirecting bare specifiers from labs/ to core/frontend dependencies.
 */
export function resolveLabDepsPlugin(): Plugin {
  return {
    name: 'vvwa-resolve-lab-deps',
    resolveId(source, importer) {
      if (!importer || !isBareSpecifier(source)) {
        return null;
      }
      if (importer.replaceAll('\\', '/').startsWith(LABS_DIR_PREFIX)) {
        return this.resolve(source, FRONTEND_ENTRY, { skipSelf: true });
      }
      return null;
    },
  };
}

/** Vite configuration with @/ path alias, labs/ dependency resolution, and FastAPI /api proxy. */
export default defineConfig({
  plugins: [resolveLabDepsPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
    // Bind mounts from a Windows/macOS host into Docker do not deliver inotify events,
    // so HMR for core/frontend/src and labs/ needs polling inside the container.
    watch: {
      usePolling: process.env.VITE_WATCH_POLLING === 'true',
      interval: 300,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
