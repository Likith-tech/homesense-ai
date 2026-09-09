import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative asset paths: works from a GitHub Pages project subpath, a plain
  // static host, or a double-clicked dist/index.html — no rewrite rules,
  // no hardcoded repo name. Safe with HashRouter since routing never touches
  // the base path.
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, open: false },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
})
