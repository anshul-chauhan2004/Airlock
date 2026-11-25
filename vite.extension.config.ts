import { defineConfig } from 'vite'
import { ocrAssets } from './ocr-assets'
import { pdfAssets } from './pdf-assets'

export default defineConfig({
  base: './',
  plugins: [ocrAssets(), pdfAssets()],
  publicDir: 'extension',
  build: { outDir: 'dist-extension' },
})
