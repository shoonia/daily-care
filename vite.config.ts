import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'src',
  plugins: [
    VitePWA({
      // Apply new versions when the app is reopened, without interrupting editing.
      registerType: 'prompt',
      injectRegister: 'script',
      manifestFilename: 'manifest.json',
      includeAssets: ['icons/*.png'],
      manifest: {
        id: './',
        name: 'Мій ритм — сад турботи',
        short_name: 'Мій ритм',
        description: 'Твій щоденний календар турботи із соняшниками на варті.',
        lang: 'uk',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f7ec',
        theme_color: '#f5f7ec',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  // Relative asset paths also work under /repository/ on GitHub Pages.
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
