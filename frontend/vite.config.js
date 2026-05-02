import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Vendor chunk splitting — büyük kütüphaneler ayrı dosyalarda kalır,
    // app kodu değiştiğinde bu chunk'ların hash'i değişmez (cache hit).
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/recharts/')) return 'recharts'
          if (id.includes('/xlsx/')) return 'xlsx'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
            return 'react-vendor'
          }
          return undefined
        },
      },
    },
  },
  esbuild: {
    // console.log/debug üretimde silinsin; warn/error korunur (api.js error logları).
    pure: ['console.log', 'console.debug'],
  },
  test: {
    environment: "node",
  },
})