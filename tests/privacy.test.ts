import assert from 'node:assert/strict'
import test from 'node:test'
import {
  containsDetectedEntity, privacyChoices, pseudonymize, restoreOriginals, reviewChoices,
} from '../src/privacy.ts'
import { readAnswer } from '../src/questions.ts'

test('kept full names take precedence over hidden aliases, with a working share gate', () => {
  const original = 'Mr. Maya Rao paid Rs. 2,500. Email maya@example.test by 10 December 2026.'
  const choices = privacyChoices(original, [{ text: 'Maya Rao', type: 'person' }])
  const review = reviewChoices(original, choices.map((entity) => ({
    ...entity, hidden: entity.text !== 'Maya Rao' && entity.type !== 'amount',
  })))
  assert.ok(review.text.includes('Maya Rao'))
  assert.ok(review.text.includes('2,500'))
  assert.ok(review.text.includes('10 December 2026'))
  assert.ok(!review.text.includes('maya@example.test'))
  assert.equal(containsDetectedEntity(review.text, review), false)
  assert.equal(containsDetectedEntity(review.text + ' contact other@example.test', review), true)
  assert.equal(restoreOriginals(review.text, review.originals), original)
})

test('questions reuse document placeholders and mask newly introduced details', () => {
  const review = pseudonymize('Maya must call.', [{ text: 'Maya', type: 'person' }])
  const question = pseudonymize('Can Maya email me at new@example.test?', [
    ...review.entities, { text: 'new@example.test', type: 'email' },
  ], review.originals)
  assert.equal(question.text, 'Can [PERSON_1] email me at [EMAIL_1]?')
  assert.equal(containsDetectedEntity(question.text, question), false)
  assert.equal(containsDetectedEntity(question.text + ' new@example.test', question), true)
})

test('answers require a quote from the reviewed document, then restore locally', () => {
  const document = '[PERSON_1] must submit proof by 10 December 2026.'
  const originals = new Map([['[PERSON_1]', 'Maya']])
  const supported = readAnswer(JSON.stringify({
    answer: '[PERSON_1] must submit proof.', evidence: [document],
  }), document, originals)
  assert.equal(supported.answer, 'Maya must submit proof.')
  assert.deepEqual(supported.evidence, ['Maya must submit proof by 10 December 2026.'])
  const unsupported = readAnswer(JSON.stringify({
    answer: 'Pay a fee.', evidence: ['A fee is required.'],
  }), document, originals)
  assert.equal(unsupported.evidence.length, 0)
  assert.ok(!unsupported.answer.includes('Pay a fee'))
})

const examples = [
  {
    name: 'pension notice',
    text: 'Notice No.: DEMO/PB/2026/0042. Mr. Arun Das. Aadhaar No.: 0000 1111 2222. Submit by 10 December 2026.',
    secrets: ['DEMO/PB/2026/0042', 'Arun Das', '0000 1111 2222'],
    visible: ['10 December 2026'],
  },
  {
    name: 'bank letter',
    text: 'Account No.: 00112233445566. IFSC: DEMO0001234. PAN: ZZZZZ1234Z. Date: 12 November 2026.',
    secrets: ['00112233445566', 'DEMO0001234', 'ZZZZZ1234Z'],
    visible: ['12 November 2026'],
  },
  {
    name: 'appointment notice',
    text: 'Mrs. Mina Roy. Date of birth: 08/05/1972. Please attend on 15 December 2026. Phone: +91 90000 12345.',
    secrets: ['Mina Roy', '08/05/1972', '+91 90000 12345'],
    visible: ['15 December 2026'],
  },
  {
    name: 'income letter',
    text: 'Monthly income: Rs. 2,500. Annual income: INR 1,86,000. Email: contact@example.test. Paid since April 2023.',
    secrets: ['2,500', '1,86,000', 'contact@example.test'],
    visible: ['April 2023'],
  },
  {
    name: 'notice without a deadline',
    text: 'Case ID: DEMO-7281. Contact Dr. Neha Gill at 0172-9876543. No action is requested.',
    secrets: ['DEMO-7281', 'Neha Gill', '0172-9876543'],
    visible: ['No action is requested.'],
  },
]
for (const example of examples) {
  test(`local privacy rules cover the fictional ${example.name}`, () => {
    const review = reviewChoices(example.text, privacyChoices(example.text, []))
    for (const secret of example.secrets) assert.ok(!review.text.includes(secret), 'Expected private field remained visible')
    for (const visible of example.visible) assert.ok(review.text.includes(visible), 'Required context was hidden')
    assert.equal(containsDetectedEntity(review.text, review), false)
    assert.equal(restoreOriginals(review.text, review.originals), example.text)
  })
}

test('ordinary question wording survives incorrect model labels and polluted document entities', async () => {
  const { preparePrivateQuestion } = await import('../src/questions.ts')
  const question = 'what needs to be done to clear this notice?'
  const wrong = [
    { text: 'what', type: 'identifier' },
    { text: 'clear this notice', type: 'organization' },
  ]
  const review = pseudonymize('A notice is available.', wrong)
  const prepared = preparePrivateQuestion(question, wrong, review)
  assert.equal(prepared.text, question)
  assert.equal(containsDetectedEntity(prepared.text, prepared), false)
})

test('question validation retains real names, identifiers and new contact details', async () => {
  const { preparePrivateQuestion } = await import('../src/questions.ts')
  const review = pseudonymize('Maya Rao received case DEMO-42.', [
    { text: 'Maya Rao', type: 'person' }, { text: 'DEMO-42', type: 'identifier' },
  ])
  const question = 'Can Maya Rao send case DEMO-42 to North Pine LLP at new@example.test?'
  const prepared = preparePrivateQuestion(question, [
    { text: 'Can', type: 'person' },
    { text: 'North Pine LLP', type: 'organization' },
  ], review)
  assert.equal(prepared.text, 'Can [PERSON_1] send case [IDENTIFIER_1] to [ORGANIZATION_1] at [EMAIL_1]?')
  assert.equal(containsDetectedEntity(prepared.text, prepared), false)
  assert.equal(restoreOriginals(prepared.text, prepared.originals), question)
})
