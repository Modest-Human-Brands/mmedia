import { AwsClient } from 'aws4fetch'

/* type R2Config = {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  bucket: string
  region?: string // for R2: 'auto'
} */

const r2CdnClientSingleton = () => {
  return new AwsClient({
    accessKeyId: process.env.MOTIA_CDN_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MOTIA_CDN_R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: process.env.MOTIA_CDN_R2_REGION || 'auto',
  })
}

declare const globalThis: {
  r2CdnGlobal: ReturnType<typeof r2CdnClientSingleton>
} & typeof globalThis

const r2Cdn = globalThis.r2CdnGlobal ?? r2CdnClientSingleton()

export default r2Cdn

if (process.env.NODE_ENV !== 'production') globalThis.r2CdnGlobal = r2Cdn
