import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is '/' for local dev; the GitHub Pages build passes
// VITE_BASE=/agri-schema-my/ so asset URLs resolve under the project sub-path.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  build: {
    // Inline every asset (fonts/images) as data URIs so the build has no
    // separate asset files — a prerequisite for a single standalone HTML.
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
  },
})
