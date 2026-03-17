import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Writable } from 'node:stream'

export default async function (outPath: string, webStream: ReadableStream) {
  await mkdir(dirname(outPath), { recursive: true })

  const file = createWriteStream(outPath)
  const webWritable = Writable.toWeb(file)

  try {
    await webStream.pipeTo(webWritable)
  } catch (error_) {
    file.destroy()
    try {
      await rm(outPath).catch(() => {})
    } catch {
      /* empty */
    }
    throw new Error(`Failed to write file: ${outPath}`, { cause: error_ as unknown })
  }
}
