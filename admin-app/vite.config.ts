import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The admin app is copied into the /admin/ Pages subdirectory.
  base: '/admin/',
})
