// Chrome session storage is memory-only and restricted to trusted extension contexts.
// Never fall back to local/sync storage if session storage fails.
export const sessionKey = (windowId: number) => `airlock-session-v1-${windowId}`

export function encodeSession(value: unknown): string {
  return JSON.stringify({ version: 1, value }, (_key, item) =>
    item instanceof Map ? { __airlockMap: [...item] } : item)
}

export function decodeSession<T>(encoded: unknown): T | null {
  if (typeof encoded !== 'string') return null
  try {
    const parsed = JSON.parse(encoded, (_key, item) => {
      if (item && typeof item === 'object' && Object.keys(item).length === 1 && Array.isArray(item.__airlockMap)) {
        return new Map(item.__airlockMap)
      }
      return item
    })
    return parsed?.version === 1 ? parsed.value as T : null
  } catch { return null }
}

type SessionArea = Pick<chrome.storage.SessionStorageArea, 'get' | 'set' | 'remove' | 'setAccessLevel'>

export function sessionStore(area: SessionArea, windowId: number) {
  const key = sessionKey(windowId)
  let pending: Promise<void> = Promise.resolve()
  function enqueue(action: () => Promise<void>) {
    const next = pending.then(action)
    pending = next.catch(() => {})
    return next
  }
  return {
    async load<T>() {
      await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
      return decodeSession<T>((await area.get(key))[key])
    },
    save(value: unknown) {
      const encoded = encodeSession(value)
      return enqueue(() => area.set({ [key]: encoded }))
    },
    clear() { return enqueue(() => area.remove(key)) },
  }
}
