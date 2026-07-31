import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Reuse vite.config (React plugin, etc.) so JSX/TSX compiles the same way in
// tests, then layer the test-only settings on top.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
)
