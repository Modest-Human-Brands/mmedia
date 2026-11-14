import { AwsClient } from 'aws4fetch'

/* type S3Config = {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  bucket: string
  region?: string // default: auto
} */

const s3DriveClientSingleton = () => {
  return new AwsClient({
    accessKeyId: process.env.MOTIA_MMEDIA_DRIVE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MOTIA_MMEDIA_DRIVE_S3_SECRET_ACCESS_KEY!,
    service: 's3',
    region: process.env.MOTIA_MMEDIA_DRIVE_S3_REGION || 'auto',
  })
}

const globalStore = globalThis as unknown as { s3DriveGlobal?: ReturnType<typeof s3DriveClientSingleton> }

const s3Drive = globalStore.s3DriveGlobal ?? s3DriveClientSingleton()

export default s3Drive

if (process.env.NODE_ENV !== 'production') globalStore.s3DriveGlobal = s3Drive
