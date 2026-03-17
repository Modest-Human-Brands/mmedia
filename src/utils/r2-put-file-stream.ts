import mimeTypes from 'mime-types'

interface R2PutOptions {
  endpoint: string
  bucket: string
}

const defaultOptions: R2PutOptions = {
  endpoint: import.meta.env.NUXT_PRIVATE_R2_ENDPOINT!,
  bucket: import.meta.env.NUXT_PRIVATE_R2_BUCKET!,
}

export default async function (objectKey: string, webStream: ReadableStream, byteLength: number, { endpoint, bucket }: R2PutOptions = defaultOptions) {
  const url = `${endpoint}/${bucket}/${objectKey}`

  let res: Response
  const contentType = mimeTypes.contentType(mimeTypes.lookup(objectKey) || 'application/octet-stream') || 'application/octet-stream'
  try {
    res = await r2Cdn.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': byteLength.toString(),
      },
      body: await new Response(webStream).blob(),
    })
  } catch (error_) {
    throw new Error('Failed to upload (network error)', { cause: error_ as unknown }) // ES2022 cause
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
