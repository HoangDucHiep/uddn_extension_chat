import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/**
 * Vite config rieng cho CONTENT SCRIPT.
 *
 * LY DO tach rieng (rule mv3-chrome.mdc §6 — Build):
 *  Content script cua Chrome KHONG phai ES module. Neu bundle chua lenh
 *  `import ... from "./assets/xxx.js"`, Chrome bao loi
 *  "Could not load file 'content.js' for content script. It isn't a module."
 *  → content script se KHONG chay duoc.
 *
 * Vì vậy content script build o dang IIFE: 1 file, tu chua, khong `import`.
 * Build nay chay SAU build chinh (`vite.config.ts`) va KHONG xoá `dist/`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §3, rule mv3-chrome.mdc §6
 */
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    // KHONG emptyOutDir — giữ output cua build sidepanel/service worker.
    emptyOutDir: false,
    sourcemap: false,
    target: 'es2022',
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/contentScript.ts'),
      name: 'SidekickContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
})
