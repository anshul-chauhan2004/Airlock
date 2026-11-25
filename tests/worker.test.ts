import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { webcrypto } from 'node:crypto'

function event() {
  const listeners = new Set<(...args: any[]) => any>()
  return {
    addListener(listener: (...args: any[]) => any) { listeners.add(listener) },
    removeListener(listener: (...args: any[]) => any) { listeners.delete(listener) },
    fire(...args: any[]) { return [...listeners].map(listener => listener(...args)) },
  }
}

function worker() {
  const stored: Record<string, unknown> = {}
  const granted = new Set<string>()
  const scripts = new Map<string, any>()
  const badges = new Map<number, string>()
  const pageMessages: any[] = []
  const tabs = [{ id: 7, windowId: 1, active: true, url: 'https://chatgpt.com/c/demo' }]
  const chrome = {
    runtime: {
      id: 'airlock-test', onInstalled: event(), onStartup: event(), onConnect: event(), onMessage: event(),
      getURL: (path: string) => 'chrome-extension://airlock-test/' + path,
    },
    storage: { local: {
      get: async (key: string) => ({ [key]: stored[key] }),
      set: async (values: object) => { Object.assign(stored, values) },
    } },
    permissions: {
      onRemoved: event(),
      contains: async ({ origins }: { origins: string[] }) => origins.every(origin => granted.has(origin)),
      remove: async ({ origins }: { origins: string[] }) => {
        for (const origin of origins) granted.delete(origin)
        chrome.permissions.onRemoved.fire({ origins })
        return true
      },
    },
    scripting: {
      getRegisteredContentScripts: async ({ ids }: { ids: string[] }) => ids.flatMap(id => scripts.has(id) ? [scripts.get(id)] : []),
      registerContentScripts: async (values: any[]) => { for (const value of values) scripts.set(value.id, value) },
      updateContentScripts: async (values: any[]) => { for (const value of values) scripts.set(value.id, value) },
      unregisterContentScripts: async ({ ids }: { ids: string[] }) => { for (const id of ids) scripts.delete(id) },
      executeScript: async () => [{ result: { text: 'Visible fixture', truncated: false } }],
    },
    tabs: {
      query: async (query: any) => tabs.filter(tab => (!query.windowId || tab.windowId === query.windowId) &&
        (!query.url || tab.url.startsWith(query.url.replace('/*', '/')))),
      get: async () => tabs[0],
      sendMessage: async (_tabId: number, message: any) => {
        pageMessages.push(message)
        return message.type === 'airlock-read-page' ? { text: 'Visible fixture', truncated: false } : { ok: true }
      },
      onActivated: event(), onUpdated: event(), onRemoved: event(),
    },
    action: {
      onClicked: event(),
      setBadgeText: async ({ tabId, text }: { tabId: number; text: string }) => { badges.set(tabId, text) },
      setBadgeBackgroundColor: async () => {},
    },
    sidePanel: { open: async () => {}, setPanelBehavior: async () => {} },
    contextMenus: { onClicked: event(), removeAll: async () => {}, create: () => {} },
    windows: { onRemoved: event() },
  }
  vm.runInNewContext(readFileSync('extension/worker.js', 'utf8'), {
    chrome, crypto: webcrypto, TextEncoder, URL, console,
    setTimeout: (callback: () => void, delay: number) => { const timer = setTimeout(callback, delay); timer.unref(); return timer },
  })
  const panel = { id: chrome.runtime.id, url: chrome.runtime.getURL('index.html') }
  const sender = { id: chrome.runtime.id, url: tabs[0].url, tab: tabs[0] }
  function send(message: object, from = panel as any): Promise<any> {
    return new Promise(resolve => chrome.runtime.onMessage.fire(message, from, resolve))
  }
  return { chrome, tabs, stored, granted, scripts, badges, pageMessages, panel, sender, send }
}

test('current page extraction runs on request without enabling background checks', async () => {
  const fixture = worker()
  const result = await fixture.send({ type: 'airlock-read-current-page', windowId: 1 })
  assert.equal(result.ok, true)
  assert.equal(result.text, 'Visible fixture')
  assert.equal(fixture.scripts.size, 0)
  assert.deepEqual(fixture.stored, {})
})
test('direct PDFs and Word files are routed to the local document reader', async () => {
  for (const extension of ['pdf', 'docx']) {
    const fixture = worker()
    fixture.tabs[0].url = 'https://example.test/notice.' + extension
    const result = await fixture.send({ type: 'airlock-read-current-page', windowId: 1 })
    assert.equal(result.fileUrl, fixture.tabs[0].url)
    assert.equal(result.name, 'notice.' + extension)
  }
})
test('restricted browser pages return an actionable error', async () => {
  const fixture = worker()
  fixture.tabs[0].url = 'chrome://settings/'
  const result = await fixture.send({ type: 'airlock-read-current-page', windowId: 1 })
  assert.equal(result.ok, false)
  assert.match(result.error, /Open file/)
})

test('Office viewer resolves the document source instead of extracting toolbar text', async () => {
  const fixture = worker()
  const source = 'https://cdn.example.test/template.docx?download=1'
  fixture.tabs[0].url = 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(source)
  const preview = await fixture.send({ type: 'airlock-page-source', windowId: 1 })
  assert.equal(preview.sourceUrl, source)
  const result = await fixture.send({ type: 'airlock-read-current-page', windowId: 1, tabId: preview.tabId, pageUrl: preview.pageUrl })
  assert.equal(result.fileUrl, source)
  assert.equal(result.name, 'template.docx')
})

test('Office viewer rejects local or executable source URLs', async () => {
  for (const source of ['file:///private/document.docx', 'javascript:alert(1)']) {
    const fixture = worker()
    fixture.tabs[0].url = 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(source)
    const result = await fixture.send({ type: 'airlock-page-source', windowId: 1 })
    assert.equal(result.ok, false)
  }
})

test('page changes during permission approval cannot import a different document', async () => {
  const fixture = worker()
  const preview = await fixture.send({ type: 'airlock-page-source', windowId: 1 })
  fixture.tabs[0].url = 'https://example.test/other.pdf'
  const result = await fixture.send({ type: 'airlock-read-current-page', windowId: 1, tabId: preview.tabId, pageUrl: preview.pageUrl })
  assert.equal(result.ok, false)
  assert.match(result.error, /page changed/)
})
