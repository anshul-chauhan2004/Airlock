import { sitePattern } from './page-types.ts'

export const isExtension = import.meta.env.MODE === 'extension' &&
  location.protocol === 'chrome-extension:'

async function command(message: object) {
  const { id: windowId } = await chrome.windows.getCurrent()
  const response = await chrome.runtime.sendMessage({ ...message, windowId })
  if (!response?.ok) throw new Error(response?.error ?? 'Chrome could not complete this action.')
  return response
}

export async function readCurrentPage(progress: (text: string) => void): Promise<{ text: string; truncated: boolean; note?: string }> {
  const source = await command({ type: 'airlock-page-source' })
  const sourceUrl = new URL(source.sourceUrl)
  if (['http:', 'https:'].includes(sourceUrl.protocol)) {
    const origins = [sitePattern(sourceUrl.href)]
    if (!await chrome.permissions.contains({ origins })) {
      const granted = await chrome.permissions.request({ origins })
      if (!granted) throw new Error('Site access was declined. Retry Use this page and allow access, or use Open file.')
    }
  }
  const result = await command({ type: 'airlock-read-current-page', tabId: source.tabId, pageUrl: source.pageUrl })
  if (!result.fileUrl) return result
  const url = new URL(result.fileUrl)
  if (!['https:', 'http:', 'file:'].includes(url.protocol)) throw new Error('Use Open file for this document viewer.')
  if (url.protocol === 'file:' && !await chrome.extension.isAllowedFileSchemeAccess()) {
    throw new Error('Enable “Allow access to file URLs” in Airlock’s extension details, or use Open file.')
  }
  try {
    const response = await fetch(url.href, { credentials: 'include', signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error('Document download failed.')
    const type = response.headers.get('content-type') || ''
    let name = result.name || 'document'
    if (type.includes('application/pdf')) name = 'document.pdf'
    else if (type.includes('wordprocessingml')) name = 'document.docx'
    else if (type.includes('text/plain')) name = 'document.txt'
    else if (result.probe && !/\.(pdf|docx|txt|md)$/i.test(name)) throw new Error('This viewer does not expose a readable document.')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Empty document.')
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 20 * 1024 * 1024) { await reader.cancel(); throw new Error('Document exceeds 20 MB.') }
      chunks.push(value)
    }
    const { readLocalDocument } = await import('./documents')
    const imported = await readLocalDocument(new File(chunks, name, { type }), progress)
    return { ...imported, truncated: false }
  } catch (cause) {
    throw new Error((cause instanceof Error ? cause.message : 'Could not read this document.') + ' Use Open file to import it directly.')
  }
}

export function listenForSelection(receive: (text: string) => void) {
  let active = true
  let port: chrome.runtime.Port | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  function connect(windowId: number) {
    const connection = chrome.runtime.connect({ name: 'airlock-panel' })
    port = connection
    connection.onMessage.addListener((message) => {
      if (!active) return
      if (typeof message === 'string') receive(message)
    })
    connection.onDisconnect.addListener(() => {
      if (port === connection) port = undefined
      if (active) retryTimer = setTimeout(() => connect(windowId), 1000)
    })
    connection.postMessage({ windowId })
  }
  chrome.windows.getCurrent().then(({ id }) => {
    if (active && id !== undefined) connect(id)
  }).catch(console.error)
  return () => { active = false; clearTimeout(retryTimer); port?.disconnect() }
}
