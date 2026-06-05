import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const deepseekKey = env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/languagetool': {
          target: 'https://api.languagetool.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/languagetool/, ''),
        },
        '/api/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (deepseekKey) {
                proxyReq.setHeader('Authorization', `Bearer ${deepseekKey}`)
              }
            })
          },
        },
      },
    },
  }
})
