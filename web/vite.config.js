import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em desenvolvimento o app roda em :5173 e a API em :8020. O proxy faz os dois
// parecerem a mesma origem, que e como ficam em producao — assim o codigo do app
// nunca precisa saber se esta em dev ou no ar.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8020', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8020', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8020', ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
})
