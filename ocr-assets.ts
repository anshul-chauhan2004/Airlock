import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const files = new Map([
  ['tesseract-LICENSE.txt', 'node_modules/tesseract.js/LICENSE.md'],
  ['core-LICENSE.txt', 'node_modules/tesseract.js-core/LICENSE'],
  ['language-data-README.txt', 'node_modules/@tesseract.js-data/eng/README.md'],
  ['worker.min.js', 'node_modules/tesseract.js/dist/worker.min.js'],
  ['eng.traineddata.gz', 'node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz'],
  ...['', '-simd', '-relaxedsimd'].map((variant) => [
    `tesseract-core${variant}-lstm.wasm.js`,
    `node_modules/tesseract.js-core/tesseract-core${variant}-lstm.wasm.js`,
  ]),
])

export function ocrAssets(): Plugin {
  return {
    name: 'airlock-local-ocr',
    async buildStart() {
      for (const [name, path] of files) {
        this.emitFile({ type: 'asset', fileName: 'ocr/' + name, source: await readFile(resolve(path)) })
      }
    },
    configureServer(server) {
      server.middlewares.use('/ocr', async (request, response, next) => {
        const path = files.get((request.url ?? '').split('?')[0].replace(/^\//, ''))
        if (!path) return next()
        try {
          response.setHeader('Content-Type', path.endsWith('.gz') ? 'application/octet-stream' : 'text/javascript')
          response.end(await readFile(resolve(path)))
        } catch (error) { next(error) }
      })
    },
  }
}
