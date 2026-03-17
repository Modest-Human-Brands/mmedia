import type { AwsClient } from 'aws4fetch'

function xmlUnescape(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// Parse minimal fields from ListObjects XML
function parseList(xml: string) {
  const keys: string[] = []
  const keyRegex = /<Key>([^<]+)<\/Key>/g
  let m: RegExpExecArray | null
  while ((m = keyRegex.exec(xml))) keys.push(xmlUnescape(m[1]))

  const isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
  const nextTokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)
  const nextContinuationToken = nextTokenMatch ? xmlUnescape(nextTokenMatch[1]) : undefined
  return { keys, isTruncated, nextContinuationToken }
}

export default async function (r2: AwsClient, cfg: { endpoint: string; bucket: string }, opts: { prefix?: string; maxKeys?: number } = {}): Promise<string[]> {
  const all: string[] = []
  const maxKeys = Math.min(Math.max(opts.maxKeys || 1000, 1), 1000) // S3 cap = 1000
  let continuationToken: string | undefined

  do {
    const base = cfg.endpoint.replace(/\/+$/, '')
    const url = new URL(`${base}/${encodeURIComponent(cfg.bucket)}`)
    url.searchParams.set('list-type', '2')
    url.searchParams.set('max-keys', String(maxKeys))
    if (opts.prefix) url.searchParams.set('prefix', opts.prefix)
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken)

    const res = await r2.fetch(url.toString(), { method: 'GET' })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`ListObjects failed: ${res.status} ${res.statusText} ${body}`)
    }

    const xml = await res.text()
    const { keys, isTruncated, nextContinuationToken } = parseList(xml)
    for (const k of keys) all.push(k)
    continuationToken = isTruncated ? nextContinuationToken : undefined
  } while (continuationToken)

  return all
}
