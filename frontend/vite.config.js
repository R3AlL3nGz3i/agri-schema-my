import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Inline every asset (fonts/images) as data URIs so the build has no
    // separate asset files — a prerequisite for a single standalone HTML.
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
  },
})
