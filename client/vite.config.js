import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes rarely, so give it its own long-lived cacheable chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@clerk')) return 'vendor-clerk'
          if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-socket'
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('@reduxjs') || id.includes('redux') || id.includes('immer') || id.includes('reselect')) return 'vendor-state'
          return undefined
        }
      }
    }
  }
})
