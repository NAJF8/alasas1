import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The independent Admin build is mounted at the unified site's /admin/ path.
  base: '/admin/',
})
