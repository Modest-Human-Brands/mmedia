import { AwsClient } from 'aws4fetch'

/* type R2Config = {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  bucket: string
  region?: string // for R2: 'auto'
} */

const r2DriveClientSingleton = () => {
  return new AwsClient({
    accessKeyId: process.env.MOTIA_DRIVE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MOTIA_DRIVE_R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: process.env.MOTIA_DRIVE_R2_REGION || 'auto',
  })
}

// eslint-disable-next-line no-shadow-restricted-names
declare const globalThis: {
  r2DriveGlobal: ReturnType<typeof r2DriveClientSingleton>
} & typeof globalThis

const r2Drive = globalThis.r2DriveGlobal ?? r2DriveClientSingleton()

export default r2Drive

if (process.env.NODE_ENV !== 'production') globalThis.r2DriveGlobal = r2Drive
