import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

export function pdfAssets(): Plugin {
  const directories = ['standard_fonts', 'cmaps']
  return {
    name: 'airlock-pdf-assets',
    async buildStart() {
      for (const directory of directories) {
        const root = resolve('node_modules/pdfjs-dist', directory)
        for (const name of await readdir(root)) {
          this.emitFile({
            type: 'asset',
            fileName: `pdf/${directory}/${name}`,
            source: await readFile(resolve(root, name)),
          })
        }
      }
    },
    configureServer(server) {
      server.middlewares.use('/pdf', async (request, response, next) => {
        const path = (request.url ?? '').split('?')[0].split('/').filter(Boolean)
        if (path.length !== 2 || !directories.includes(path[0]) || !/^[\w.-]+$/.test(path[1])) return next()
        try {
          response.setHeader('Content-Type', 'application/octet-stream')
          response.end(await readFile(resolve('node_modules/pdfjs-dist', path[0], path[1])))
        } catch (error) { next(error) }
      })
    },
  }
}
