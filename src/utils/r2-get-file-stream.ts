import r2Cdn from './r2-cdn'
import r2Drive from './r2-drive'

export default async function (objectKey: string, objectOrigin: 'cache' | 'origin' = 'cache', endpoint = process.env.NUXT_PRIVATE_R2_ENDPOINT!, bucket = process.env.NUXT_PRIVATE_R2_BUCKET!) {
  const url = `${endpoint}/${bucket}/${objectKey}`

  const res = await (objectOrigin === 'cache' ? r2Cdn : r2Drive).fetch(url, { method: 'GET' })
  if (!(res.ok && res.body)) {
    throw new Error(JSON.stringify({ statusCode: res.status, message: res.statusText }))
  }

  return {
    stream: res.body,
    byteLength: Number.parseInt(res.headers.get('content-length') || '0'),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  }
}
