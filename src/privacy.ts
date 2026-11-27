export type Entity = { text: string; type: string }

export function parseEntities(output: string, types: string[]): Entity[] {
  const parsed = JSON.parse(output)
  if (!Array.isArray(parsed?.entities) || !parsed.entities.every((entity: Entity) =>
    typeof entity?.text === 'string' && entity.text.trim() && types.includes(entity.type))) {
    throw new Error('Local detection returned invalid results. Try again before sending.')
  }
  return parsed.entities
}

export function entityPattern(text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const left = /^[\p{L}\p{N}]/u.test(text) ? '(?<![\\p{L}\\p{N}])' : ''
  const right = /[\p{L}\p{N}]$/u.test(text) ? '(?![\\p{L}\\p{N}])' : ''
  return left + escaped + right
}

export function pseudonymize(document: string, entities: Entity[], reserved: ReadonlyMap<string, string> = new Map(), allowed: Entity[] = []) {
  const normalized = new Map(
    entities.map(({ text, type }) => [text.trim().toLowerCase(), type]),
  )
  const allowedValues = new Set(allowed.map((entity) => entity.text.trim().toLowerCase()))
  const patterns = [...new Set([...normalized.keys(), ...allowedValues])]
    .sort((a, b) => b.length - a.length)
    .map(entityPattern)
  const replacements = new Map<string, string>()
  const originals = new Map(reserved)
  const counts = new Map<string, number>()
  const existingText = document.toUpperCase()
  const highlights: { start: number; end: number; text: string; type: string }[] = []

  const text = patterns.length ? document.replace(new RegExp(patterns.join('|'), 'giu'), (match, offset: number) => {
    if (allowedValues.has(match.toLowerCase())) return match
    highlights.push({ start: offset, end: offset + match.length, text: match, type: normalized.get(match.toLowerCase()) ?? 'private' })
    // Preserve the spelling of each distinct original for local restoration.
    const existing = replacements.get(match) ??
      [...reserved].find(([, original]) => original === match)?.[0]
    if (existing) return existing
    const type = (normalized.get(match.toLowerCase()) ?? 'private').toUpperCase()
    let count = counts.get(type) ?? 0
    let placeholder: string
    do {
      placeholder = `[${type}_${++count}]`
    } while (existingText.includes(placeholder) || originals.has(placeholder))
    counts.set(type, count)
    replacements.set(match, placeholder)
    originals.set(placeholder, match)
    return placeholder
  }) : document

  return { text, originals, entities, allowed, highlights }
}

const formattedPatterns = [
  { type: 'identifier', pattern: /\b\d{12,18}\b/g },
  { type: 'identifier', pattern: /\b(?:loan\s+account|(?:savings\s+)?account|file\s+reference|invoice\s+no\.?|gstin)(?:[ \t]+(?:no\.?|number|id))?[ \t]*[:#]?[ \t]+([a-z0-9]+(?:[/-][a-z0-9]+)*)(?![a-z0-9/-])/gi },
  { type: 'email', pattern: /\b[\w.%+-]+@[a-z][\w.-]*\b/gi },
  { type: 'amount', pattern: /(?:₹|\b(?:Rs\.?|INR))[ \t]*(\d+(?:,\d{2,3})*(?:\.\d{1,2})?)(?![\d,])/gi },
  { type: 'email', pattern: /[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi },
  { type: 'phone', pattern: /(?<!\d)(?:\+91[ .-]?)?[6-9]\d{4}[ .-]?\d{5}(?!\d)/g },
  { type: 'phone', pattern: /\b0\d{2,4}[- ]\d{6,8}\b/g },
  { type: 'phone', pattern: /(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\b\d{3})[ .-]\d{3}[ .-]\d{4}\b/g },
  { type: 'identifier', pattern: /\b[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}\b/g },
  { type: 'identifier', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/gi },
  { type: 'identifier', pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/gi },
  { type: 'identifier', pattern: /\b(?:aadhaar|aadhar)(?:[ \t]+(?:no\.?|number|id))?[ \t]*[.:#]*[ \t]*(\d{12})(?!\d)/gi },
  { type: 'identifier', pattern: /\b(?:notice|case|account|member|policy|customer|claim|scheme)(?:[ \t]+(?:no\.?|number|id))[ \t]*[.:#]*[ \t]*([a-z0-9]+(?:[/-][a-z0-9]+)*)(?![a-z0-9/-])/gi },
  { type: 'identifier', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
]

export function findFormattedDetails(text: string): Entity[] {
  return formattedPatterns.flatMap(({ pattern, type }) =>
    [...text.matchAll(pattern)]
      .filter((match) => type !== 'identifier' || /\d/.test(match[1] ?? match[0]))
      .map((match) => ({ text: match[1] ?? match[0], type })))
}

const month = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
const dateValue = `(?:\\d{1,2}(?:st|nd|rd|th)?[ \\t]+${month}(?:[ ,]+\\d{4})?|${month}[ \\t]+\\d{1,2}(?:st|nd|rd|th)?(?:,?[ \\t]+\\d{4})?|${month}[ \\t]+\\d{4}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`
const dates = new RegExp(`\\b${dateValue}\\b`, 'gi')
const birthDate = new RegExp(`\\b(?:date\\s+of\\s+birth|d\\.?o\\.?b\\.?|born(?:\\s+on)?)\\s*[:=]?\\s*(${dateValue})\\b`, 'gi')
const nameWord = "[A-Z]\\p{L}+(?:[-’']\\p{L}+)*"
const namesWithTitles = new RegExp(`\\b(?:Mr\\.?|Mrs\\.?|Ms\\.?|Dr\\.?|Shri|Sardar|Smt\\.?)[ \\t]+(${nameWord}(?:[ \\t]+${nameWord}){0,3})`, 'gu')

export function preparePrivateDetails(text: string, detected: Entity[]): Entity[] {
  const birthDates = [...text.matchAll(birthDate)].map((match) => match[1])
  const privateDates = new Set(birthDates.map((date) => date.toLowerCase()))
  const publicDates = [...text.matchAll(dates)]
    .map((match) => match[0].toLowerCase())
    .filter((date) => !privateDates.has(date))
  const titledNames = [...text.matchAll(namesWithTitles)].map((match) => match[1])
  const modelDetails = detected.filter((entity) => {
    const value = entity.text.trim().toLowerCase()
    return !publicDates.some((date) => date.includes(value) || value.includes(date))
  })
  const names = [...titledNames, ...modelDetails
    .filter((entity) => entity.type === 'person')
    .map((entity) => entity.text)]
  const aliases = names.flatMap((name) => {
    const words = name.trim().split(/\s+/)
    return words.length > 1 ? [words[0], words[words.length - 1]] : []
  }).filter((word) => /^\p{L}{3,}$/u.test(word))
  return [
    ...modelDetails,
    ...titledNames.map((text) => ({ text, type: 'person' })),
    ...aliases.map((text) => ({ text, type: 'person' })),
    ...birthDates.map((text) => ({ text, type: 'identifier' })),
    ...findFormattedDetails(text),
  ]
}

export function containsDetectedEntity(text: string, review: ReturnType<typeof pseudonymize>) {
  let visibleText = text.replace(/\[[A-Z]+_\d+\]/g, (placeholder) =>
    review.originals.has(placeholder) ? ' ' : placeholder).toLowerCase()
  for (const entity of review.allowed ?? []) {
    visibleText = visibleText.replace(new RegExp(entityPattern(entity.text.trim()), 'giu'), ' ')
  }
  return findFormattedDetails(visibleText).length > 0 ||
    review.entities.some((entity) => new RegExp(entityPattern(entity.text.trim()), 'iu').test(visibleText))
}

export function restoreOriginals(text: string, originals: Map<string, string>) {
  return text.replace(/\[[A-Z]+_\d+\]/g, (placeholder) => originals.get(placeholder) ?? placeholder)
}

export type PrivacyChoice = Entity & { hidden: boolean }

export function privacyChoices(text: string, detected: Entity[]): PrivacyChoice[] {
  const unique = new Map<string, Entity>()
  for (const entity of preparePrivateDetails(text, detected)) {
    if (new RegExp(entityPattern(entity.text.trim()), 'iu').test(text)) {
      unique.set(entity.text.trim().toLowerCase(), { ...entity, text: entity.text.trim() })
    }
  }
  return [...unique.values()].map((entity) => ({ ...entity, hidden: true }))
}

export function reviewChoices(text: string, choices: PrivacyChoice[]) {
  return pseudonymize(text, choices.filter((entity) => entity.hidden), new Map(),
    choices.filter((entity) => !entity.hidden))
}
