import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import ts from 'typescript'
import { readLocalDocument } from '../src/documents.ts'
import { containsDetectedEntity, privacyChoices, reviewChoices, pseudonymize, restoreOriginals } from '../src/privacy.ts'

test('text import enforces character and byte boundaries without network access', async () => {
  assert.equal((await readLocalDocument(new File(['a'.repeat(12000)], 'limit.txt'))).text.length, 12000)
  await assert.rejects(readLocalDocument(new File(['a'.repeat(12001)], 'over.txt')), /12,000/)
  await assert.rejects(readLocalDocument(new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.txt')), /20 MB/)
  await assert.rejects(readLocalDocument(new File([' \n '], 'empty.md')), /No readable text/)
  await assert.rejects(readLocalDocument(new File(['data'], 'file.zip')), /Choose a PDF/)
  assert.equal((await readLocalDocument(new File(['  # Notice  '], 'NOTICE.MD'))).text, '# Notice')
})

test('manual hiding preserves existing mappings and replaces repeated literal punctuation', () => {
  const original = 'Maya Rao: Room 12; Room 12; A+B (East). Existing [PRIVATE_1].'
  const first = pseudonymize(original, [{ text: 'Maya Rao', type: 'person' }])
  const hidden = pseudonymize(first.text, [
    { text: 'Room 12', type: 'private' }, { text: 'A+B (East)', type: 'private' },
  ], first.originals)
  assert.ok(!hidden.text.includes('Room 12'))
  assert.ok(!hidden.text.includes('A+B (East)'))
  assert.ok(hidden.text.includes('Existing [PRIVATE_1]'))
  assert.equal(restoreOriginals(hidden.text, hidden.originals), original)
})

test('distinct name spellings restore exactly and new documents have independent mappings', () => {
  const text = 'Mr. Lila Sen met LILA SEN and Ms. Tara Sen.'
  const first = reviewChoices(text, privacyChoices(text, []))
  assert.equal(restoreOriginals(first.text, first.originals), text)
  const next = pseudonymize('Omar Vale', [{ text: 'Omar Vale', type: 'person' }])
  assert.equal(next.text, '[PERSON_1]')
  assert.deepEqual([...next.originals.values()], ['Omar Vale'])
  assert.ok(![...first.originals.values()].includes('Omar Vale'))
})

// Exercise the actual request function without loading React, Firebase, or a browser.
// Firebase is replaced by a recording stub; this does not verify the SDK wire payload.
const source = ts.createSourceFile('main.tsx', fs.readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let requestSource = ''
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'requestAnalysis') requestSource = node.getText(source)
  ts.forEachChild(node, visit)
}
visit(source)
assert.ok(requestSource, 'Request function must be found in application source')
const requestJs = ts.transpileModule(requestSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
function harness(review: ReturnType<typeof pseudonymize>, fail = false) {
  const receipts: any[] = []
  const calls: string[] = []
  const model = { generateContent: async (prompt: string) => {
    calls.push(prompt)
    if (fail) throw new Error('simulated failure')
    return { response: { inferenceSource: 'in_cloud', text: () => 'Synthetic response' } }
  } }
  const request = new Function('review', 'containsDetectedEntity', 'setReceipt', 'setBusyLabel', 'getModels', `${requestJs}; return requestAnalysis`)(
    review, containsDetectedEntity, (value: any) => receipts.push(value), () => {},
    () => ({ hybrid: { reasoner: model, checklist: model, question: model } }),
  )
  return { request, receipts, calls }
}

test('request details record the exact model argument and reviewed question', async () => {
  const review = pseudonymize('Maya must reply.', [{ text: 'Maya', type: 'person' }])
  const question = pseudonymize('When must Maya reply?', review.entities, review.originals)
  const prompt = `Document:\n${review.text}\nQuestion:\n${question.text}`
  const h = harness(review)
  const result = await h.request(prompt, 'question', question)
  assert.deepEqual(h.calls, [prompt])
  assert.equal(h.receipts.at(-1).prompt, prompt)
  assert.equal(h.receipts.at(-1).document, review.text)
  assert.equal(h.receipts.at(-1).question, question.text)
  assert.equal(h.receipts.at(-1).source, result.source)
  assert.ok(!JSON.stringify(h.receipts).includes('Maya'))
})

test('unsafe document or question is rejected before the model is called', async () => {
  const review = pseudonymize('Maya must reply.', [{ text: 'Maya', type: 'person' }])
  const unsafe = harness({ ...review, text: review.text + ' Maya' })
  await assert.rejects(unsafe.request('unused', 'reasoner'), /private details/)
  assert.equal(unsafe.calls.length, 0)
  assert.equal(unsafe.receipts.length, 0)
  const safe = harness(review)
  await assert.rejects(safe.request('unused', 'question', { ...review, text: 'Ask Maya' }), /question/)
  assert.equal(safe.calls.length, 0)
})

test('failed model request preserves submitted fields and records failure', async () => {
  const review = pseudonymize('Maya must reply.', [{ text: 'Maya', type: 'person' }])
  const h = harness(review, true)
  await assert.rejects(h.request(review.text, 'reasoner'), /simulated failure/)
  assert.equal(h.receipts.at(-1).source, 'Request failed')
  assert.equal(h.receipts.at(-1).prompt, h.calls[0])
})
