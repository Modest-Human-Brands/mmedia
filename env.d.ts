interface ImportMetaEnv {
  readonly NODE_ENV: 'development' | 'production'
  readonly HOSTNAME: string
  readonly MOTIA_APP_VERSION: string
  readonly MOTIA_APP_BUILD_TIME: string
  readonly MOTIA_DRIVE_R2_ENDPOINT: string
  readonly MOTIA_DRIVE_R2_BUCKET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
