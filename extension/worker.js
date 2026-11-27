const panels = new Map()
const pending = new Map()
const menuId = 'airlock-open-selection'
const ownPanel = sender => sender?.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('index.html')

// Remove the previous opt-in monitoring scripts when upgrading Airlock.
async function cleanupMonitoring() {
  const scripts = await chrome.scripting.getRegisteredContentScripts()
  const ids = scripts.filter(script => script.id.startsWith('airlock-')).map(script => script.id)
  if (ids.length) await chrome.scripting.unregisterContentScripts({ ids })
  for (const tab of await chrome.tabs.query({})) {
    if (!tab.id) continue
    await chrome.tabs.sendMessage(tab.id, { type: 'airlock-stop-checks' }).catch(() => {})
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' }).catch(() => {})
  }
  await chrome.storage.local.remove('airlockSites')
}
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll().then(() => chrome.contextMenus.create({
    id: menuId, title: 'Open in Airlock', contexts: ['selection'],
  })).catch(console.error)
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  void cleanupMonitoring().catch(console.error)
})
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'airlock-panel' || !ownPanel(port.sender)) return
  let windowId
  port.onMessage.addListener(message => {
    if (windowId !== undefined || !Number.isInteger(message?.windowId)) return
    windowId = message.windowId
    panels.set(windowId, port)
    const item = pending.get(windowId)
    pending.delete(windowId)
    if (item && item.expires > Date.now()) port.postMessage(item.text)
  })
  port.onDisconnect.addListener(() => { if (panels.get(windowId) === port) panels.delete(windowId) })
})
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== menuId || !info.selectionText || tab?.windowId == null) return
  const text = info.selectionText.trim().slice(0, 12001)
  const opened = chrome.sidePanel.open({ windowId: tab.windowId })
  const port = panels.get(tab.windowId)
  if (port) port.postMessage(text)
  else {
    const item = { text, expires: Date.now() + 15000 }
    pending.set(tab.windowId, item)
    setTimeout(() => { if (pending.get(tab.windowId) === item) pending.delete(tab.windowId) }, 15000)
  }
  opened.catch(() => pending.delete(tab.windowId))
})

// Serialized by Chrome and executed only after the user chooses Use this page.
function extractPage() {
  const pdf = document.querySelector('embed[type="application/pdf"],object[type="application/pdf"]')
  if (pdf) return { fileUrl: pdf.getAttribute('src') || pdf.getAttribute('data') || location.href, name: 'document.pdf' }
  const selection = window.getSelection()?.toString().trim()
  if (selection) return { text: selection, truncated: selection.length > 12000 }
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT)
  const parts = []
  let length = 0, nodes = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (++nodes > 50000) return { text: parts.join('\n'), truncated: true }
    const parent = node.parentElement
    if (!parent || parent.closest('script,style,noscript,input,textarea,select,[hidden],[aria-hidden="true"],[data-airlock-ui]') || !parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
    const text = node.textContent.trim()
    if (!text) continue
    length += text.length + 1
    if (length > 12000) return { text: parts.join('\n'), truncated: true }
    parts.push(text)
  }
  return { text: parts.join('\n'), truncated: false }
}
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (!ownPanel(sender) || !['airlock-read-current-page', 'airlock-page-source'].includes(request?.type)) return
  ;(async () => {
    const [tab] = await chrome.tabs.query({ active: true, windowId: request.windowId })
    if (!tab?.id || !tab.url) throw new Error('Click Airlock’s toolbar icon on the page, then retry. For local PDFs, also enable “Allow access to file URLs” in Airlock’s extension details.')
    const url = new URL(tab.url)
    if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw new Error('Chrome restricts this viewer. Use Open file or select and copy its text.')
    let source = url
    // Office Online renders its chrome separately from the source document.
    if (url.hostname === 'view.officeapps.live.com' && /^\/op\/(view|embed)\.aspx$/i.test(url.pathname)) {
      const value = url.searchParams.get('src')
      if (!value) throw new Error('This Office viewer has no document link. Use Open file.')
      source = new URL(value)
      if (!['https:', 'http:'].includes(source.protocol) || source.username || source.password) throw new Error('Unsupported Office document link. Use Open file.')
    }
    if (request.type === 'airlock-page-source') return { ok: true, tabId: tab.id, pageUrl: tab.url, sourceUrl: source.href }
    if (request.tabId !== undefined && (request.tabId !== tab.id || request.pageUrl !== tab.url)) throw new Error('The active page changed. Click Use this page again.')
    if (source.href !== url.href) return { ok: true, fileUrl: source.href, name: decodeURIComponent(source.pathname.split('/').pop() || 'document.docx'), probe: true }
    if (/\.(pdf|docx|txt|md)$/i.test(url.pathname)) return { ok: true, fileUrl: tab.url, name: decodeURIComponent(url.pathname.split('/').pop()) }
    try {
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage })
      return { ok: true, ...results[0].result }
    } catch {
      // Chrome’s PDF viewer may block script injection; inspect the original URL locally.
      return { ok: true, fileUrl: tab.url, name: 'document', probe: true }
    }
  })().then(respond, error => respond({ ok: false, error: error.message }))
  return true
})
chrome.windows.onRemoved.addListener(id => { panels.delete(id); pending.delete(id) })

// Closing a whole window discards its private session. Closing only the panel does not.
chrome.windows?.onRemoved?.addListener(windowId => {
  void chrome.storage.session.remove(`airlock-session-v1-${windowId}`).catch(() => {})
})
