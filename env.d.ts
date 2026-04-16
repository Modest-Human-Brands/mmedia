interface ImportMetaEnv {
  readonly NODE_ENV: 'development' | 'production'
  readonly HOSTNAME: string

  readonly MOTIA_APP_VERSION: string
  readonly MOTIA_APP_BUILD_TIME: string

  readonly MOTIA_DRIVE_R2_ENDPOINT: string
  readonly MOTIA_DRIVE_R2_BUCKET: string

  readonly MOTIA_OME_HOST: string
  readonly MOTIA_OME_API_PROTOCOL: string
  readonly MOTIA_OME_API_PORT: string
  readonly MOTIA_OME_SRT_PORT: string
  readonly MOTIA_OME_HLS_PORT: string
  readonly MOTIA_OME_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
