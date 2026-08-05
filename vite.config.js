import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Puerto fijo, distinto del 5173 por defecto — en esta máquina el 5173
    // ya lo usa otra app (un sitio de un club, "Cultura Física", sin
    // ninguna relación con este proyecto). strictPort corta el arranque en
    // vez de saltar a otro puerto en silencio si el 5183 también estuviera
    // ocupado — así nunca queda ambiguo contra qué app está hablando el
    // navegador (o Playwright/lo que sea) al pegarle a "localhost:<puerto>".
    port: 5183,
    strictPort: true,
  },
})
