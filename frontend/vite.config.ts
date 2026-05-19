import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080'
  const wsTarget = target.startsWith('https')
    ? target.replace(/^https/, 'wss')
    : target.replace(/^http/, 'ws')

  return {
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './src'),
      },
    },
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true, secure: false },
        '/auth': { target, changeOrigin: true, secure: false },
        '/ws': { target: wsTarget, ws: true, secure: false },
      },
    },
  }
})
