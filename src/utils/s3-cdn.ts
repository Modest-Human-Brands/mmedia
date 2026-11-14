import { AwsClient } from 'aws4fetch'

/* type S3Config = {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  bucket: string
  region?: string // default: auto
} */

const s3CdnClientSingleton = () => {
  return new AwsClient({
    accessKeyId: process.env.MOTIA_MMEDIA_CDN_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MOTIA_MMEDIA_CDN_S3_SECRET_ACCESS_KEY!,
    service: 's3',
    region: process.env.MOTIA_MMEDIA_CDN_S3_REGION || 'auto',
  })
}

const globalStore = globalThis as unknown as { s3CdnGlobal?: ReturnType<typeof s3CdnClientSingleton> }

const s3Cdn = globalStore.s3CdnGlobal ?? s3CdnClientSingleton()

export default s3Cdn

if (process.env.NODE_ENV !== 'production') globalStore.s3CdnGlobal = s3Cdn
