import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vite config cho Chrome MV3 extension — side panel + service worker.
 *
 * - `base: './'` bat buoc: duong dan asset phai relative de load unpacked.
 * - Manifest + icon duoc copy nguyen vao `dist/` (khong hash ten).
 * - `sidepanel.html` nam o root project nen build ra `dist/sidepanel.html`
 *   — dung duong dan `side_panel.default_path` trong manifest.
 *
 * Content script build RIENG bang `vite.content.config.ts` (IIFE, 1 file,
 * khong co `import`) — Chrome khong load duoc content script dang ESM.
 * Docs: docs/SYSTEM_DESIGN.md §3, rule mv3-chrome.mdc §6
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, 'sidepanel.html'),
        background: resolve(import.meta.dirname, 'src/background/serviceWorker.ts'),
      },
      output: {
        // Khong hash ten file — manifest tro toi duong dan co dinh.
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})
