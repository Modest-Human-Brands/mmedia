import { imageMeta } from 'image-meta'
import { readFile, stat } from 'node:fs/promises'

export interface ImageFormat {
  filename: string
  formatName: string
  size: number
  width: number
  height: number
}

export interface ImageMetadata {
  format: ImageFormat
}

export default async function (filePath: string): Promise<ImageMetadata> {
  const [data, fileStat] = await Promise.all([readFile(filePath), stat(filePath)])

  const meta = imageMeta(data)

  if (typeof meta.width !== 'number' || typeof meta.height !== 'number') {
    throw new TypeError(`Could not determine image dimensions for: ${filePath}`)
  }

  return {
    format: {
      filename: filePath,
      formatName: meta.type ?? '',
      size: fileStat.size,
      width: meta.width,
      height: meta.height,
    },
  }
}
