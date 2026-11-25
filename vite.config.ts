import { defineConfig } from 'vite'
import { ocrAssets } from './ocr-assets'
import { pdfAssets } from './pdf-assets'

export default defineConfig({ plugins: [ocrAssets(), pdfAssets()] })
