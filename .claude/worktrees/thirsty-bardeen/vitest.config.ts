import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [
    svelte({
      // Hot-Module nicht nötig in Tests
      hot: false,
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    // TypeScript-Dateien vor JS bevorzugen (constants.ts statt constants.js)
    extensions: ['.ts', '.mts', '.js', '.mjs', '.jsx', '.tsx', '.json'],
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@lib': resolve(__dirname, 'src/renderer/src/lib'),
      '@components': resolve(__dirname, 'src/renderer/src/components'),
    },
  },
})
