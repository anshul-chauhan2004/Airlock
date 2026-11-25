import {
  entityPattern, parseEntities, preparePrivateDetails, pseudonymize, type Entity,
} from './privacy.ts'

const chunkSize = 1200
const chunkOverlap = 120
export const scanChunkTimeout = 60_000

export function splitScanText(text: string): string[] {
  const chunks: string[] = []
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + chunkSize, text.length)
    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end)
      if (boundary > end - chunkOverlap) end = boundary
    }
    chunks.push(text.slice(start, end))
    if (end === text.length) break
    start = end - chunkOverlap
  }
  return chunks
}

export function scanPlan(text: string) {
  const known = preparePrivateDetails(text, [])
  const masked = pseudonymize(text, known).text
    .replace(/\[[A-Z]+_\d+\]/g, '…')
  const seen = new Set<string>()
  const lines = masked.split(/\r?\n/).map((line) => line.trim().replace(/[ \t]+/g, ' '))
    .filter((line) => {
      if (!line || /^[=|_\- ]{6,}$/.test(line)) return false
      const key = line
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  return { known, chunks: splitScanText(lines.join('\n')) }
}

export function originalEntities(entities: Entity[], text: string): Entity[] {
  return entities.flatMap((entity) => {
    const pattern = entityPattern(entity.text.trim()).replace(/\s+/g, '\\s+')
    const original = text.match(new RegExp(pattern, 'iu'))?.[0]
    return original ? [{ text: original, type: entity.type }] : []
  })
}

export function groundedEntities(output: string, input: string, types: string[]): Entity[] {
  const entities = parseEntities(output, types).filter((entity) => !entity.text.includes('…'))
  return originalEntities(entities, input)
}
