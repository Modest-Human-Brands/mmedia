import type { AwsClient } from 'aws4fetch'
import mimeTypes from 'mime-types'

interface R2PutOptions {
  endpoint: string
  bucket: string
}

const defaultOptions: R2PutOptions = {
  endpoint: process.env.MOTIA_CDN_R2_ENDPOINT!,
  bucket: process.env.MOTIA_CDN_R2_BUCKET!,
}

export default async function (client: AwsClient, objectKey: string, webStream: ReadableStream, byteLength: number, { endpoint, bucket }: R2PutOptions = defaultOptions) {
  const url = `${endpoint}/${bucket}/${objectKey}`

  let res: Response
  const contentType = mimeTypes.contentType(mimeTypes.lookup(objectKey) || 'application/octet-stream') || 'application/octet-stream'
  try {
    res = await client.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': byteLength.toString(),
      },
      body: await new Response(webStream).blob(),
    })
  } catch (error_) {
    throw new Error('Failed to upload (network error)', { cause: error_ as unknown })
  }

  if (!res.ok) {
    let bodyText = ''
    try {
      bodyText = await res.text()
    } catch {
      /* empty */
    }
    const reason = res.statusText || 'HTTP error'
    const details = bodyText ? ` — ${bodyText.slice(0, 2000)}` : ''
    throw new Error(`Failed to upload: ${res.status} ${reason}${details}`)
  }

  return true
}
