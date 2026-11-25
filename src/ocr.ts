import { createWorker, OEM } from 'tesseract.js'

export async function createLocalOcr(progress: (text: string) => void) {
  const base = new URL('./ocr/', window.location.href).href.replace(/\/$/, '')
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: base + '/worker.min.js',
    corePath: base,
    langPath: base,
    workerBlobURL: false,
    cacheMethod: 'none',
    logger: ({ status, progress: value }) => progress(`Local OCR · ${status} · ${Math.round(value * 100)}%`),
  })
  return worker
}

export async function readImage(file: File, progress: (text: string) => void) {
  const image = await createImageBitmap(file)
  try {
    if (image.width * image.height > 25_000_000) throw new Error('Choose an image smaller than 25 megapixels.')
    const scale = Math.min(1, 2400 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    const context = canvas.getContext('2d')!
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const worker = await createLocalOcr(progress)
    try {
      const { data } = await worker.recognize(canvas)
      return { text: data.text, note: `English OCR · confidence ${Math.round(data.confidence)}%. Check names, numbers, and dates against the original.` }
    } finally { await worker.terminate() }
  } finally { image.close() }
}
