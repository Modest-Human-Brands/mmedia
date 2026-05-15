import type { AwsClient } from 'aws4fetch'

export default async function (client: AwsClient, objectKey: string, endpoint = process.env.MOTIA_CDN_R2_ENDPOINT!, bucket = process.env.MOTIA_CDN_R2_BUCKET!) {
  const url = `${endpoint}/${bucket}/${objectKey}`

  const res = await client.fetch(url, { method: 'GET' })
  if (!(res.ok && res.body)) {
    throw new Error(JSON.stringify({ statusCode: res.status, message: res.statusText }))
  }

  return {
    stream: res.body,
    byteLength: Number.parseInt(res.headers.get('content-length') || '0'),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  }
}
