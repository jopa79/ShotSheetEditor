import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { builtinModules } from 'module'

// Nur Node-Builtins und Electron externalisieren — lokale Module werden gebundelt
const externalModules = [
  'electron',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
        external: externalModules,
      },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
      },
    },
  },

  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [
      svelte({
        configFile: resolve(__dirname, 'svelte.config.mjs'),
      }),
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@lib': resolve(__dirname, 'src/renderer/src/lib'),
        '@components': resolve(__dirname, 'src/renderer/src/components'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
})
