export const documentLimit = 12_000

async function readPdf(file: File, progress: (text: string) => void) {
  const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = workerUrl
  const task = getDocument({
    data: await file.arrayBuffer(),
    useSystemFonts: false,
    useWasm: false,
    standardFontDataUrl: new URL('./pdf/standard_fonts/', window.location.href).href,
    cMapUrl: new URL('./pdf/cmaps/', window.location.href).href,
    cMapPacked: true,
  })
  let ocr: Awaited<ReturnType<typeof import('./ocr').createLocalOcr>> | undefined
  try {
    const pdf = await task.promise
    if (pdf.numPages > 60) throw new Error('Choose a PDF with 60 pages or fewer, or paste the section you want to review.')
    const pages: string[] = []
    let emptyPages = 0
    let length = 0
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const { items } = await page.getTextContent()
      let text = items.flatMap((item) => 'str' in item
        ? [item.str, item.hasEOL ? '\n' : ' ']
        : []).join('').trim()
      if (text.length < 20) {
        if (pdf.numPages > 10) throw new Error('For scanned PDFs, choose a file with 10 pages or fewer.')
        emptyPages++
        progress(`Reading scanned page ${pageNumber} of ${pdf.numPages} on this device…`)
        const { createLocalOcr } = await import('./ocr')
        ocr ??= await createLocalOcr(progress)
        const viewport = page.getViewport({ scale: 1 })
        const scale = Math.min(2, 2400 / Math.max(viewport.width, viewport.height))
        const renderViewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(renderViewport.width)
        canvas.height = Math.ceil(renderViewport.height)
        await page.render({ canvas, viewport: renderViewport }).promise
        const { data } = await ocr.recognize(canvas)
        text = data.text.trim()
        canvas.width = canvas.height = 0
      }
      length += text.length + (pages.length ? 2 : 0)
      if (length > documentLimit) throw documentTooLong()
      pages.push(text)
    }
    return {
      text: pages.join('\n\n'),
      note: emptyPages
        ? `${emptyPages} PDF page(s) read with English OCR. Check names, numbers, and dates against the original.`
        : '',
    }
  } finally {
    await ocr?.terminate()
    await task.destroy()
  }
}

function documentTooLong() {
  return new Error(`This document exceeds ${documentLimit.toLocaleString()} characters. Paste a shorter section to review.`)
}

export async function readLocalDocument(file: File, progress: (text: string) => void = () => {}) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a file smaller than 20 MB.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  let imported
  switch (extension) {
    case 'pdf':
      imported = await readPdf(file, progress)
      break
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp': {
      const { readImage } = await import('./ocr')
      imported = await readImage(file, progress)
      break
    }
    case 'docx': {
      const { extractRawText } = await import('mammoth')
      const { value, messages } = await extractRawText({ arrayBuffer: await file.arrayBuffer() })
      imported = { text: value, note: messages.length ? 'Some Word content might not have been extracted. Check against the original.' : '' }
      break
    }
    case 'txt':
    case 'md':
      imported = { text: await file.text(), note: '' }
      break
    default:
      throw new Error('Choose a PDF, Word (.docx), TXT, Markdown, PNG, JPEG, or WebP file.')
  }
  const text = imported.text.trim()
  if (!text) throw new Error('No readable text was found. Try a clearer English scan or paste the text.')
  if (text.length > documentLimit) throw documentTooLong()
  return { text, note: imported.note }
}
