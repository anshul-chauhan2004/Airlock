export function sitePattern(origin: string) {
  const url = new URL(origin)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Open a regular webpage to extract its text.')
  return url.protocol + '//' + url.hostname + '/*'
}

