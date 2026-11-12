import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
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

/** Regex khop 1 nguon font trong `@font-face`. */
const FONT_SRC_PATTERN = /src:([^;}]+)/g

/** Regex khop nguon `woff2` trong 1 khuc `src`. */
const WOFF2_PATTERN = /url\([^)]*\.woff2\)\s*format\(["']woff2["']\)//**
 * Plugin: cat phong font cua KaTeX xuong con **woff2**.
 *
 * ## Vì sao cần?
 *
 * `katex/dist/katex.min.css` khai báo `@font-face` voi **3** format:
 * `woff2` · `woff` · `ttf` → Vite copy **cả 3** vao `dist/` (~1 MB).
 * Trình duyệt hiện đại deu ho tro `woff2` → 2 format kia la **thua**.
 *
 * ## Rủi ro khi bỏ?
 *
 * - Chrome ≤ 14 (rất cũ) khong ho tro `woff2` → chữ toán fallback về
 *   font hệ thống. Manifest yêu cầu Chrome >= 114 → khong thành vấn đề.
 * - Khong ảnh hưởng content script (KaTeX chi nằm trong side panel).
 *
 * ## Vì sao làm ở `generateBundle` chứ không phải `transform`?
 *
 * `transform` chạy **trước** pipeline CSS của Vite → `code` chưa là CSS
 * cuối cùng và đường dẫn font chưa được rewrite → không đáng tin cậy.
 * `generateBundle` chạm vào **output thật** → chắc chắn đúng.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.31
 */
function katexWoff2Only(): Plugin {
  return {
    name: 'sidekick-katex-woff2-only',
    generateBundle(_options, bundle) {
      // 1. Loc CSS: moi `src:` chi giu nguon `woff2`.
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset') continue
        if (!file.fileName.endsWith('.css')) continue

        // `source` co the la `Uint8Array` (asset nhi) → chi xu ly chuoi.
        if (typeof file.source !== 'string') continue
        file.source = file.source.replace(FONT_SRC_PATTERN, (match: string, sources: string) => {
          const woff2 = WOFF2_PATTERN.exec(sources)
          return woff2 === null ? match : `src:${woff2[0]}`
        })
      }

      // 2. Xoa font `woff` / `ttf` (da thay the bang `woff2`).
      for (const key of Object.keys(bundle)) {
        const file = bundle[key]
        if (file === undefined || file.type !== 'asset') continue
        if (!/\.(woff|ttf)$/i.test(file.fileName)) continue
        delete bundle[key]
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), katexWoff2Only()],
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
