import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Configuracion de la PWA: registra el service worker para que la app
// funcione offline y sea instalable en el celular.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sistema de Ventas',
        short_name: 'Ventas',
        theme_color: '#1f1f1f',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // Cachea el catalogo para poder verlo aunque se pierda la señal
        runtimeCaching: [
          {
            urlPattern: /\/api\/catalogo/,
            handler: 'NetworkFirst',
            options: { cacheName: 'catalogo-cache' },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
