import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildSourcemap = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.VITE_BUILD_SOURCEMAP ?? '').toLowerCase(),
)

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    sourcemap: buildSourcemap,
  },
})
