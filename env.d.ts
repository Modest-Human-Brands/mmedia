interface ImportMetaEnv {
  readonly NODE_ENV: 'development' | 'production'
  readonly HOSTNAME: string

  readonly MOTIA_APP_VERSION: string
  readonly MOTIA_APP_BUILD_TIME: string

  readonly MOTIA_DRIVE_R2_ENDPOINT: string
  readonly MOTIA_DRIVE_R2_BUCKET: string

  readonly MOTIA_CDN_HOST: string
  readonly MOTIA_LIVEKIT_URL: string
  readonly MOTIA_LIVEKIT_API_KEY: string
  readonly MOTIA_LIVEKIT_API_SECRET: string

  readonly MOTIA_CDN_R2_BUCKET: string
  readonly MOTIA_CDN_R2_REGION: string
  readonly MOTIA_CDN_R2_ACCESS_KEY_ID: string
  readonly MOTIA_CDN_R2_SECRET_ACCESS_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
