interface ImportMetaEnv {
  readonly NODE_ENV: 'development' | 'production'
  readonly HOSTNAME: string

  // LiveKit (shared, unprefixed)
  readonly LIVEKIT_URL: string
  readonly LIVEKIT_API_KEY: string
  readonly LIVEKIT_API_SECRET: string

  readonly MOTIA_MMEDIA_APP_VERSION: string
  readonly MOTIA_MMEDIA_APP_BUILD_TIME: string

  // Service auth and endpoints
  readonly MOTIA_MMEDIA_API_KEY: string
  readonly MOTIA_MMEDIA_DRIVE_API_KEY: string
  readonly MOTIA_MMEDIA_SITE_URL: string
  readonly MOTIA_MMEDIA_DRIVE_URL: string
  readonly MOTIA_MMEDIA_CDN_HOST: string

  // R2 drive (origin media)
  readonly MOTIA_MMEDIA_DRIVE_R2_ENDPOINT: string
  readonly MOTIA_MMEDIA_DRIVE_R2_BUCKET: string
  readonly MOTIA_MMEDIA_DRIVE_R2_REGION: string
  readonly MOTIA_MMEDIA_DRIVE_R2_ACCESS_KEY_ID: string
  readonly MOTIA_MMEDIA_DRIVE_R2_SECRET_ACCESS_KEY: string

  // R2 CDN (transformed media and live streams)
  readonly MOTIA_MMEDIA_CDN_R2_ENDPOINT: string
  readonly MOTIA_MMEDIA_CDN_R2_BUCKET: string
  readonly MOTIA_MMEDIA_CDN_R2_REGION: string
  readonly MOTIA_MMEDIA_CDN_R2_ACCESS_KEY_ID: string
  readonly MOTIA_MMEDIA_CDN_R2_SECRET_ACCESS_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
