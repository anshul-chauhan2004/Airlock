import { entityPattern, privacyChoices, pseudonymize, restoreOriginals, type Entity } from './privacy.ts'

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

export function readAnswer(
  output: string,
  document: string,
  originals: Map<string, string>,
) {
  const parsed = JSON.parse(output)
  if (typeof parsed?.answer !== 'string' || !Array.isArray(parsed.evidence)) {
    throw new Error('The model returned an invalid answer. Try again.')
  }
  const source = normalize(document)
  const evidence = parsed.evidence
    .filter((item: unknown): item is string => typeof item === 'string' && !!item.trim())
    .map(normalize)
    .filter((item: string) => source.includes(item))
  if (!evidence.length) {
    return { answer: 'No matching supporting passage was returned. Check the document or ask a more specific question.', evidence: [] as string[] }
  }
  return {
    answer: restoreOriginals(parsed.answer, originals),
    evidence: [...new Set<string>(evidence)].map((text) => restoreOriginals(text, originals)),
  }
}

// Model labels need evidence in the question before becoming replacements.
const questionWords = /^(?:what|who|whom|whose|which|when|where|why|how|can|could|should|would|will|do|does|did|is|are|was|were|i|me|my|you|your|it|its|we|our|they|their|this|that|these|those|notice|document|invoice|question|answer|deadline|payment|clear|submit|needs|done)$/i
const ordinaryPhrase = /\b(?:what|which|how|this|that|these|those|needs? to|must be|to be)\b/i

export function preparePrivateQuestion(
  text: string,
  detected: Entity[],
  documentReview: ReturnType<typeof pseudonymize>,
) {
  const known = documentReview.entities.filter((entity) =>
    !questionWords.test(entity.text.trim()) && !ordinaryPhrase.test(entity.text))
  const knownValues = new Set(known.map((entity) => entity.text.trim().toLowerCase()))
  const candidates = detected.filter((entity) => {
    const value = entity.text.trim()
    if (questionWords.test(value) || ordinaryPhrase.test(value)) return false
    if (entity.type === 'identifier' && !/\d/.test(value)) return false
    if (entity.type === 'organization' && !knownValues.has(value.toLowerCase())) {
      const original = text.match(new RegExp(entityPattern(value), 'iu'))?.[0] ?? ''
      return /\p{Lu}/u.test(original) || /\b(?:llp|ltd|inc|bank|labs|studio|works|company)\b/i.test(original)
    }
    return true
  })
  const checked = privacyChoices(text, candidates)
  return pseudonymize(text, [...known, ...checked], documentReview.originals, documentReview.allowed)
}
