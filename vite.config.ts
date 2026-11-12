import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/** Publishes version.json next to the built assets so /version.json is fetchable. */
function appVersionPlugin(): Plugin {
  return {
    name: 'jkm-app-version',
    apply: 'build',
    closeBundle() {
      const source = path.resolve(process.cwd(), 'version.json');
      const target = path.resolve(process.cwd(), 'dist', 'version.json');
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(source, 'utf8'));
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), appVersionPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
