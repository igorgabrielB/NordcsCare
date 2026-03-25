import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost/NordcsCare',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: mode !== 'production',
  },
}))
