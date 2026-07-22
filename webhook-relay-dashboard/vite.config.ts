// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // <-- Fixed import here
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Elite Directive: Native ES module Web Workers for JSON parsing offload
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    // Proxy API calls to the Dockerized Go backend
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})