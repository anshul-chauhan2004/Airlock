import { restoreOriginals } from './privacy'

export const notice = [
  'Renewal notice for Maya Rao. Case number: BR-20491.',
  'This notice was issued on November 18, 2026.',
  'Submit proof of household income by December 10, 2026.',
  'You may submit a recent pay stub or an employer letter through your benefits portal.',
  'If you miss the December 10 deadline, your benefits may be interrupted.',
].join('\n')

export type ChecklistItem = { action: string; evidence: string; deadline?: string }

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

const month = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
const day = '\\d{1,2}(?:st|nd|rd|th)?'
const writtenDate = `(?:${day} +${month}(?: +\\d{4})?|${month} +${day}(?:,? +\\d{4})?)`
const deadlinePattern = new RegExp(`\\b(?:by|before|no later than|on or before) +(${writtenDate})\\b`, 'i')
const listHeading = /\b(?:you (?:are required to|must|need to|should)|(?:complete|take|follow) the following)\b/i
const numberedItem = /^\s*(\d{1,2})[.)]\s+(.+)/

function readNumberedInstructions(
  reviewedText: string,
  original: string,
  originals: Map<string, string>,
): ChecklistItem[] {
  const lines = reviewedText.split(/\r?\n/)
  const items: ChecklistItem[] = []
  for (let index = 0; index < lines.length; index++) {
    const heading = normalize(lines[index])
    const deadline = heading.match(deadlinePattern)?.[1]
    const originalHeading = normalize(restoreOriginals(heading, originals))
    if (!deadline || !heading.endsWith(':') || !listHeading.test(heading) || !original.includes(originalHeading)) continue
    const list: ChecklistItem[] = []
    let cursor = index + 1
    while (cursor < lines.length && !lines[cursor].trim()) cursor++
    for (let number = 1; cursor < lines.length; number++) {
      const item = lines[cursor].match(numberedItem)
      if (!item || Number(item[1]) !== number) break
      const itemLines = [lines[cursor++]]
      while (cursor < lines.length && lines[cursor].trim() && !numberedItem.test(lines[cursor])) {
        itemLines.push(lines[cursor++])
      }
      while (cursor < lines.length && !lines[cursor].trim()) cursor++
      const evidence = normalize(restoreOriginals(itemLines.join(' '), originals))
      if (!original.includes(evidence)) break
      const action = evidence.replace(numberedItem, '$2')
      list.push({ action, evidence: originalHeading + '\n' + evidence, deadline })
    }
    if (list.length) {
      items.push(...list)
      index = cursor - 1
    }
  }
  return items
}

export function readChecklist(
  output: string,
  reviewedText: string,
  originalDocument: string,
  originals: Map<string, string>,
): ChecklistItem[] {
  const original = normalize(originalDocument)
  const numberedActions = readNumberedInstructions(reviewedText, original, originals)
  if (numberedActions.length) return numberedActions
  const parsed = JSON.parse(output)
  if (!Array.isArray(parsed?.items)) throw new Error('The model returned an invalid checklist. Try again.')
  const reviewed = normalize(reviewedText)
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(original)]
    .map(({ segment }) => segment.trim())
  const items: ChecklistItem[] = []
  const seen = new Set<string>()
  for (const item of parsed.items) {
    if (typeof item?.action !== 'string' || typeof item.evidence !== 'string') continue
    const evidence = normalize(item.evidence)
    const restored = normalize(restoreOriginals(evidence, originals))
    if (!item.action.trim() || !evidence || !reviewed.includes(evidence) || !original.includes(restored)) continue
    const matchingSentences = sentences.filter((sentence) => sentence.includes(restored))
    const sentence = matchingSentences[0]
    if (matchingSentences.length !== 1 || /^if you (?:miss|do not|don't|fail to)\b/i.test(sentence)) continue
    if (seen.has(sentence)) continue
    seen.add(sentence)
    const deadline = sentence.match(deadlinePattern)?.[1]
    items.push({ action: restoreOriginals(item.action, originals), evidence: sentence, deadline })
  }
  return items
}
