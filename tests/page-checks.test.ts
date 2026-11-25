import assert from 'node:assert/strict'
import test from 'node:test'
import { sitePattern } from '../src/page-types.ts'

test('site permissions are scoped to the selected web host', () => {
  assert.equal(sitePattern('https://chatgpt.com/c/example'), 'https://chatgpt.com/*')
  assert.equal(sitePattern('http://localhost:5173/notice'), 'http://localhost/*')
  assert.throws(() => sitePattern('chrome://settings'))
  assert.throws(() => sitePattern('file:///tmp/private.txt'))
})

