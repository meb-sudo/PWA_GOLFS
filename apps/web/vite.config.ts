import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      // Pas de manifest par defaut : il n aurait pas d `id` (=> id "/") et
      // serait partage par tous les groupes, donc "app deja installee" des qu un
      // groupe est installe. On sert UNIQUEMENT les manifests par groupe
      // (public/manifests/*), avec un `id` distinct, injectes tot par le script
      // inline de index.html. Le service worker, lui, reste genere normalement.
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
        // Les appels API ne sont jamais servis par le fallback de navigation.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Images de club : stables, cache long.
            urlPattern: /^\/api\/media\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'golf-media',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Contenus consultables hors ligne.
            urlPattern: /^\/api\/(news|notifications|carnets|reservations)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'golf-content',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Disponibilites et authentification : jamais de cache.
            urlPattern: /^\/api\/(auth|clubs\/.*\/availability|booking)/,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5180,
    proxy: {
      // La PWA n appelle que sa propre origine : le probleme CORS de
      // l API amont ne la concerne jamais.
      '/api': {
        target: process.env.BFF_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    // Meme proxy que le dev pour que le build servi par `vite preview` parle
    // au BFF (test de l installation PWA en conditions reelles).
    proxy: {
      '/api': {
        target: process.env.BFF_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Les librairies changent rarement : les isoler leur donne un cache
        // long, et une mise a jour applicative ne les fait pas retelecharger.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          motion: ['motion'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
});
