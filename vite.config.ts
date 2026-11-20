import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Sandbox (preview) overrides.
 *
 * BASE44_PREVIEW_MODE is supplied by the Base44 platform. When it is exactly
 * "1" the dev server also accepts the proxied preview host, which is
 * `<port>-<sandbox id>.<sandbox host domain>`. The sandbox id rotates, so only
 * the wildcard suffix is allowed. When the flag is absent or has any other
 * value the shared configuration behaves as a normal Vite dev server.
 */
const previewMode = process.env.BASE44_PREVIEW_MODE === '1';
const sandboxDomain = process.env.BASE44_SANDBOX_HOST_DOMAIN;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Vite >= 6.1 also reads __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS.
    allowedHosts:
      previewMode && sandboxDomain
        ? [`.${sandboxDomain}`, 'localhost', '.localhost']
        : undefined,
    watch: {
      // Bind mounts on the sandbox do not always deliver inotify events.
      usePolling: previewMode,
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
