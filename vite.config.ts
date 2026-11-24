/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages: https://<user>.github.io/meeting-minutes/
const base = process.env.BASE_PATH ?? '/meeting-minutes/';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // رقم الـ commit (من GitHub Actions) وتاريخ البناء — علشان تعرف الموبايل شغال على أنهي نسخة
    __BUILD_ID__: JSON.stringify((process.env.GITHUB_SHA ?? 'local').slice(0, 7)),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  base,
  plugins: [
    preact(),
    VitePWA({
      // التحديث بموافقة المستخدم فقط: زرار «تحديث متاح»
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Meeting Follow-up',
        short_name: 'Meeting Follow-up',
        description: 'Meeting minutes and task follow-up — works offline. محاضر الاجتماعات ومتابعة المهام.',
        lang: 'ar',
        dir: 'rtl',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F6F8FA',
        theme_color: '#1F3864',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // precache كامل: كل الكود والخطوط والأيقونات → أوفلاين 100%
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,jpg}'],
        navigateFallback: 'index.html',
        // إشعار المتأخر: التحديث في الخلفية والضغط على الإشعار
        importScripts: ['sw-overdue.js'],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
  },
});
