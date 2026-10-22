import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Rolldown/oxc's minifier (Vite 8 default) mangles maplibre-gl into a runtime
  // "N1 is not defined" ReferenceError that only surfaces in the minified build,
  // breaking the map. Terser minifies it correctly. See docs/planning/ai-changelog.md.
  build: {
    minify: 'terser',
    rolldownOptions: {
      output: {
        // The maplibre-gl v6 worker ships as .mjs, but Amplify's SPA rewrite rule
        // only exempts .js (among others) — a .mjs request would get index.html.
        assetFileNames: (asset) =>
          asset.names.some((n) => n.endsWith('.mjs'))
            ? 'assets/[name]-[hash].js'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5281',
    },
  },
})
