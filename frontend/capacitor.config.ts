import type { CapacitorConfig } from '@capacitor/cli'

// iOS shell around the same Vite build the website ships. `webDir` is bundled
// into the .ipa, so the app opens from local files (capacitor://localhost) and
// only data calls go over the network.
const config: CapacitorConfig = {
  appId: 'com.suburblensapp.app',
  appName: 'SuburbLens',
  webDir: 'dist',
  // Matches `bg-ink`, so there is no white flash before the first paint.
  backgroundColor: '#0d0f14',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0d0f14',
      showSpinner: false,
    },
  },
}

export default config
