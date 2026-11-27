import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeSession, encodeSession, sessionKey, sessionStore } from '../src/session.ts'
import { pseudonymize, restoreOriginals } from '../src/privacy.ts'

function memoryArea() {
  const data: Record<string, unknown> = {}
  const access: string[] = []
  const area = {
    setAccessLevel: async ({ accessLevel }: { accessLevel: string }) => { access.push(accessLevel) },
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => { Object.assign(data, structuredClone(items)) },
    remove: async (key: string) => { delete data[key] },
  }
  return { data, access, area: area as unknown as chrome.storage.SessionStorageArea }
}

test('session JSON preserves local mappings, reviewed edits and completed scan chunks', () => {
  const review = pseudonymize('Maya Rao must reply.', [{ text: 'Maya Rao', type: 'person' }])
  review.text += ' Reviewed.'
  const state = { stage: 'review', review, cache: new Map([['chunk', [{ text: 'Maya Rao', type: 'person' }]]]), interrupted: 'Privacy scan' }
  const restored = decodeSession<typeof state>(encodeSession(state))!
  assert.deepEqual(restored, state)
  assert.equal(restoreOriginals(restored.review.text, restored.review.originals), 'Maya Rao must reply. Reviewed.')
})

test('reopening restores the same window and restricts storage access', async () => {
  const { area, access } = memoryArea()
  const first = sessionStore(area, 7)
  await first.load()
  await first.save({ document: 'Fictional document', stage: 'privacy' })
  assert.deepEqual(await sessionStore(area, 7).load(), { document: 'Fictional document', stage: 'privacy' })
  assert.equal(await sessionStore(area, 8).load(), null)
  assert.ok(access.every(value => value === 'TRUSTED_CONTEXTS'))
})

test('clear is ordered after pending saves and does not erase other windows', async () => {
  const { area, data } = memoryArea()
  const first = sessionStore(area, 7)
  const other = sessionStore(area, 8)
  await other.save({ document: 'Other' })
  await Promise.all([first.save({ document: 'Old' }), first.save({ document: 'Latest' }), first.clear()])
  assert.equal(data[sessionKey(7)], undefined)
  assert.deepEqual(await other.load(), { document: 'Other' })
  await first.save({ document: 'New' })
  assert.deepEqual(await first.load(), { document: 'New' })
})

test('failed saves surface errors and do not prevent later clearing', async () => {
  const { area } = memoryArea()
  area.set = async () => { throw new Error('quota') }
  const store = sessionStore(area, 7)
  await assert.rejects(store.save({ document: 'Test' }), /quota/)
  await store.clear()
  assert.equal(await store.load(), null)
})

test('invalid or outdated session encodings are ignored', () => {
  for (const value of [null, {}, '', '{', '{"version":0,"value":{}}', '{"version":1,"value":{"__airlockMap":[3]}}']) {
    assert.equal(decodeSession(value), null)
  }
})
