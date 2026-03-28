import { mkdir } from 'node:fs/promises'

export default async function (path: string, mode?: number) {
  const a = path.split('/').slice(0, -1)
  const b = path.split('/').at(-1)!
  const finalPath = b.split('.').length > 1 ? a.join('/') : path
  await mkdir(finalPath, { recursive: true, mode })
}
