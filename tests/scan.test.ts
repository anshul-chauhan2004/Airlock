import assert from 'node:assert/strict'
import test from 'node:test'
import { groundedEntities, scanPlan, splitScanText } from '../src/scan.ts'
import { privacyChoices, restoreOriginals, reviewChoices } from '../src/privacy.ts'

test('scan preparation handles repeated private formats before model extraction', () => {
  const text = [
    'Mr. Arun Das, loan account HL-0045-7712-3390.',
    'File reference: DEMO/2026/42',
    'PAN: ZZZZZ1234Z. Aadhaar: 0000 1111 2222.',
    'Income Rs. 52,000. Email arun@example.test.',
    'Please contact Mr. Arun Das by 25 November 2026.',
    'Income Rs. 52,000. Email arun@example.test.',
    '==========================================',
  ].join('\n')
  const plan = scanPlan(text)
  const input = plan.chunks.join('\n')
  for (const value of ['Arun Das', 'HL-0045-7712-3390', 'DEMO/2026/42', 'ZZZZZ1234Z',
    '0000 1111 2222', '52,000', 'arun@example.test']) {
    assert.ok(!input.includes(value), 'Recognized private value was sent back to the detector')
  }
  assert.ok(input.includes('25 November 2026'))
  assert.ok(!input.includes('======'))
  assert.equal(input.split('Income').length - 1, 1)
  const review = reviewChoices(text, privacyChoices(text, plan.known))
  assert.equal(restoreOriginals(review.text, review.originals), text)
})

test('smaller overlapping scan chunks preserve complete text and boundary entities', () => {
  const text = 'ordinary text '.repeat(80) + 'North Pine Institute' + ' more words'.repeat(300)
  const chunks = splitScanText(text)
  assert.ok(chunks.length > 1)
  assert.ok(chunks.every((chunk) => chunk.length <= 1200))
  assert.equal(chunks[0] + chunks.slice(1).map((chunk) => chunk.slice(120)).join(''), text)
  assert.ok(chunks.some((chunk) => chunk.includes('North Pine Institute')))
})

test('model results must occur in the remaining input and exclude masking markers', () => {
  const output = JSON.stringify({ entities: [
    { text: 'North Pine', type: 'organization' },
    { text: 'Made Up Bank', type: 'organization' },
    { text: 'Mr. …', type: 'person' },
  ] })
  assert.deepEqual(groundedEntities(output, 'Mr. … works at North Pine.', ['person', 'organization']),
    [{ text: 'North Pine', type: 'organization' }])
})

test('model entities map back to the original spacing and line breaks', async () => {
  const { originalEntities } = await import('../src/scan.ts')
  const entities = [{ text: 'North Pine Institute', type: 'organization' }]
  const original = 'Employer: North   Pine\nInstitute'
  const mapped = originalEntities(entities, original)
  assert.deepEqual(mapped, [{ text: 'North   Pine\nInstitute', type: 'organization' }])
  const review = reviewChoices(original, privacyChoices(original, mapped))
  assert.ok(!review.text.includes('North'))
  assert.equal(restoreOriginals(review.text, review.originals), original)
})
