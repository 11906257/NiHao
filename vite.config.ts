import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const base = process.env.BASE_PATH || '/';
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('BASE_PATH muss mit / beginnen und enden.');
export default defineConfig({
  base,
  // Keep emitted syntax compatible with Safari 15.4+, which supplies our required web APIs.
  build: { target: ['safari15.4', 'chrome100'], sourcemap: true },
  plugins: [react(), VitePWA({
    // App activates waiting updates automatically when no learning or save is in progress.
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
    manifest: {
      id: base, name: 'Nǐ Hǎo · HSK 3.0 lernen', short_name: 'Nǐ Hǎo', description: 'Dein persönlicher Lernraum für HSK 3.0 Level 1.',
      lang: 'de', start_url: base, scope: base, display: 'standalone', background_color: '#f7f6f2', theme_color: '#b92328',
      icons: [{src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png'}, {src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any'}, {src: `${base}icon-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable'}]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,json,woff2}'], maximumFileSizeToCacheInBytes: 4000000, navigateFallback: `${base}index.html`, cleanupOutdatedCaches: true },
    devOptions: {enabled: false}
  })],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' }
});
