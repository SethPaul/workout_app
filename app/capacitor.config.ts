import type { CapacitorConfig } from '@capacitor/cli';

// Android packaging (see ANDROID.md). The web bundle is built with
// `vite build --mode native` (no service worker) and copied into the native
// project by `cap sync`; the app runs fully offline from those assets.
const config: CapacitorConfig = {
  appId: 'io.github.sethpaul.workout',
  appName: 'Workout',
  webDir: 'dist',
  // Matches the app's dark theme so there's no white flash while loading.
  backgroundColor: '#111318',
  android: {
    // The bundle never loads remote content.
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // The app already lays out with viewport-fit=cover and
      // env(safe-area-inset-*) padding, so let it draw edge-to-edge.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      // Light status-bar icons on the dark background.
      style: 'DARK',
    },
  },
};

export default config;
