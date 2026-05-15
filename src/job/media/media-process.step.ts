import { queue, logger, Handlers, StepConfig } from 'motia'
import { $fetch } from 'ofetch'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import s3Driver from 'unstorage/drivers/s3'
import z from 'zod'
import { Readable, Writable } from 'node:stream'
import { createWriteStream } from 'node:fs'

import getMediaMetadata from 'src/utils/get-media-metadata'
import r2Drive from 'src/utils/r2-drive'
import r2GetAllFiles from 'src/utils/r2-get-all-files'
import r2GetFileStream from 'src/utils/r2-get-file-stream'
import r2PutFileStream from 'src/utils/r2-put-file-stream'

const fs = createStorage({
  driver: fsDriver({ base: './static' }),
})

const r2DriveStorage = createStorage({
  driver: s3Driver({
    accessKeyId: process.env.MOTIA_DRIVE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MOTIA_DRIVE_R2_SECRET_ACCESS_KEY!,
    endpoint: process.env.MOTIA_DRIVE_R2_ENDPOINT!,
    bucket: process.env.MOTIA_DRIVE_R2_BUCKET!,
    region: process.env.MOTIA_DRIVE_R2_REGION || 'auto',
  }),
})

function getMediaKind(filename: string): 'photo' | 'audio' | 'video' {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'cr2', 'tiff', 'gif'].includes(ext)) return 'photo'
  if (['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(ext)) return 'audio'
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  return 'photo'
}

export const config = {
  name: 'MediaProcessor',
  description: 'Asynchronously processes files from storage by stripping metadata, extraction, and renaming',
  flows: ['media-process-flow'],
  triggers: [
    queue('media.process', {
      config: { maxRetries: 3, concurrency: 1 },
      input: z.object({
        bucket: z.string(),
        sourceKey: z.string(),
        orgId: z.string(),
        projectId: z.string(),
        uploadId: z.string(),
        batchId: z.string(),
      }),
    }),
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (input) => {
  const { bucket, sourceKey, orgId, projectId, uploadId, batchId } = input as { bucket: string; sourceKey: string; orgId: string; projectId: string; uploadId: string; batchId: string }

  console.log('----------------------------------------------')
  console.log({ bucket, sourceKey, orgId, projectId, uploadId, batchId })
  console.log('----------------------------------------------')

  const filenameWithExt = sourceKey.split('/').pop() || ''
  const dotIndex = filenameWithExt.lastIndexOf('.')
  const ext = dotIndex > 0 ? filenameWithExt.slice(dotIndex) : ''
  const nameWithoutExt = dotIndex > 0 ? filenameWithExt.slice(0, dotIndex) : filenameWithExt

  const originalNameClean = nameWithoutExt.split('-').slice(0, -2).join('-')
  const filename = `${originalNameClean}${ext}`
  const mediaKind = getMediaKind(filename)

  const orgNumericId = Number(orgId.split('-').pop()) || 0
  const projNumericId = Number(projectId.split('-').pop()) || 0

  const existingFiles = await r2GetAllFiles(r2Drive, {
    endpoint: import.meta.env.MOTIA_DRIVE_R2_ENDPOINT!,
    bucket: import.meta.env.MOTIA_DRIVE_R2_BUCKET!,
  })
  const selectedFile = existingFiles.filter((f) => f === sourceKey)![0]

  console.log('----------------------------------------------')
  console.log({ existingFiles, selectedFile })
  console.log('----------------------------------------------')

  const patternRegex = /^(photo|audio|video)-\d{5}-\d{4}-(\d{4})-\d{3}$/
  const match = originalNameClean.match(patternRegex)

  const nextMediaId = match ? Number.parseInt(match[2], 10) : Math.max(...existingFiles.map((n) => Number.parseInt(n.match(patternRegex)?.[2] || '0', 10)), 0) + 1

  const nextVariantId = match ? Math.max(...existingFiles.map((n) => Number.parseInt(n.match(new RegExp(`^(photo|audio|video)-\\d{5}-\\d{4}-${match[2]}-(\\d{3})`))?.[2] || '-1', 10)), -1) + 1 : 0

  const paddedMedia = String(nextMediaId).padStart(4, '0')
  const newMediaId = `${mediaKind}-${String(orgNumericId).padStart(5, '0')}-${String(projNumericId).padStart(4, '0')}-${paddedMedia}-${String(nextVariantId).padStart(3, '0')}${ext}`

  const destinationKey = `processed/${orgId}/${projectId}/${newMediaId}`

  const mediaId = encodeURI(selectedFile || '').replaceAll('/', '_')
  const sourcePath = `./static/source/${mediaId}`
  const storageSourceKey = `source/${mediaId}`

  console.log('----------------------------------------------')
  console.log({ destinationKey, mediaId, newMediaId })
  console.log('----------------------------------------------')

  try {
    const { stream } = await r2GetFileStream(r2Drive, encodeURI(selectedFile), import.meta.env.MOTIA_DRIVE_R2_ENDPOINT, import.meta.env.MOTIA_DRIVE_R2_BUCKET)

    await stream.pipeTo(Writable.toWeb(createWriteStream(sourcePath)))

    const metadata = await getMediaMetadata(sourcePath)
    logger.info('Metadata extraction complete', { mediaKind: metadata.kind })

    // Webhook Notification: Phase 1 Complete (60%)
    await $fetch('/webhook/uploads/status', {
      baseURL: import.meta.env.MOTIA_DRIVE_URL,
      method: 'PUT',
      body: {
        batchId,
        projectId,
        uploadId,
        filename,
        status: 'processing',
        progressPercent: 60,
        mediaId: newMediaId,
        error: null,
        data: { metadata },
      },
    })

    const fileBuffer = await fs.getItemRaw(storageSourceKey)
    const fileStream = Readable.toWeb(Readable.from(fileBuffer))

    await r2PutFileStream(r2Drive, destinationKey, fileStream, fileBuffer ? fileBuffer.byteLength : 0, {
      endpoint: import.meta.env.MOTIA_DRIVE_R2_ENDPOINT,
      bucket: import.meta.env.MOTIA_DRIVE_R2_BUCKET,
    })
    await r2DriveStorage.del(existingFiles[0])

    // Webhook Notification: Phase 2 Complete (100%)
    await $fetch('/webhook/uploads/status', {
      baseURL: import.meta.env.MOTIA_DRIVE_URL,
      method: 'PUT',
      body: {
        batchId,
        projectId,
        uploadId,
        filename,
        status: 'completed',
        progressPercent: 100,
        mediaId: newMediaId,
        error: null,
        data: null,
      },
    })
  } catch (error: any) {
    console.error(error)

    // Notify status webhook about processing failure
    await $fetch('/webhook/uploads/status', {
      baseURL: import.meta.env.MOTIA_DRIVE_URL,
      method: 'PUT',
      body: {
        batchId,
        projectId,
        uploadId,
        filename,
        status: 'failed',
        progressPercent: 100,
        mediaId: null,
        error: error.message || 'Processing execution pipeline error failed.',
        data: null,
      },
    }).catch((error_) => {
      logger.error('Failed to notify status webhook about processing error state', { fetchErr: error_.message })
    })

    // Rethrow error so Motia can trigger configured retries or dead-letter queues
    throw error
  } finally {
    await fs.removeItem(sourcePath).catch(() => {})
  }
}
