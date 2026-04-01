interface ImportMetaEnv {
  readonly NODE_ENV: 'development' | 'production'
  readonly HOSTNAME: string
  readonly MOTIA_APP_VERSION: string
  readonly MOTIA_APP_BUILD_TIME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
