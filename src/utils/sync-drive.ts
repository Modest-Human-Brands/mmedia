import r2Drive from './r2-drive'
import r2GetAllFiles from './r2-get-all-files'

export default async function () {
  const nameToPathMap: { [key: string]: string } = {}
  const allItemKeys = await r2GetAllFiles(r2Drive, {
    endpoint: import.meta.env.MOTIA_DRIVE_R2_ENDPOINT!,
    bucket: import.meta.env.MOTIA_DRIVE_R2_BUCKET!,
  })

  for (const path of allItemKeys) {
    const [_, ...b] = path.split('_')
    if (b.at(-1) === 'thumb') continue

    const key = b.join('_').split('.').slice(0, -1).join('.')
    nameToPathMap[key] = path
  }

  return nameToPathMap
}
