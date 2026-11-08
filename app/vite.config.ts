import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this app under /workout_app/, so the base path is
// configurable via VITE_BASE (defaults to '/' for local dev).
//
// `--mode native` builds the bundle that ships inside the Android app
// (Capacitor). It skips the service worker: the assets are already local, and
// a cached SW would keep serving the previous bundle after an app update.
export default defineConfig(({ mode }) => {
  const native = mode === 'native';
  const base = native ? '/' : (process.env.VITE_BASE ?? '/');
  return {
    base,
    plugins: [
      preact(),
      VitePWA({
        disable: native,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Workout',
          short_name: 'Workout',
          description: 'Garage-gym daily workout picker',
          display: 'standalone',
          theme_color: '#111318',
          background_color: '#111318',
          start_url: base,
          scope: base,
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: mode === 'development',
        },
      }),
    ],
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});
