import { queue, logger, Handlers, StepConfig } from 'motia'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import s3Driver from 'unstorage/drivers/s3'
import z from 'zod'
import { Readable, Writable } from 'node:stream'
import { createWriteStream } from 'node:fs'

import ensureDir from 'src/utils/ensure-dir'
import getMediaMetadata from 'src/utils/get-media-metadata'
import notifyDrive from 'src/utils/notify-drive'
import s3Drive from 'src/utils/s3-drive'
import s3GetAllFiles from 'src/utils/s3-get-all-files'
import s3GetFileStream from 'src/utils/s3-get-file-stream'
import s3PutFileStream from 'src/utils/s3-put-file-stream'

const fs = createStorage({
  driver: fsDriver({ base: './static' }),
})

const s3DriveStorage = createStorage({
  driver: s3Driver({
    accessKeyId: process.env.MOTIA_MMEDIA_DRIVE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MOTIA_MMEDIA_DRIVE_S3_SECRET_ACCESS_KEY!,
    endpoint: process.env.MOTIA_MMEDIA_DRIVE_S3_ENDPOINT!,
    bucket: process.env.MOTIA_MMEDIA_DRIVE_S3_BUCKET!,
    region: process.env.MOTIA_MMEDIA_DRIVE_S3_REGION || 'auto',
  }),
})

export const config = {
  name: 'MediaProcessor',
  description: 'Asynchronously processes uploaded files: metadata extraction and copy to the processed/ prefix',
  flows: ['media-process-flow'],
  triggers: [
    queue('media.process', {
      config: { maxRetries: 3, concurrency: 1 },
      input: z.object({
        bucket: z.string(),
        sourceKey: z.string(),
        orgId: z.string(),
        projectId: z.string(),
        filename: z.string(),
      }),
    }),
  ],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (input) => {
  const { sourceKey, orgId, projectId, filename } = input as { sourceKey: string; orgId: string; projectId: string; filename: string }

  // MDrive owns the file name; the processed object keeps it unchanged
  const destinationKey = `processed/${orgId}/${projectId}/${filename}`

  // Retries and duplicate storage events: skip the copy if a previous run already wrote the processed file
  const processedExists = (
    await s3GetAllFiles(
      s3Drive,
      {
        endpoint: import.meta.env.MOTIA_MMEDIA_DRIVE_S3_ENDPOINT!,
        bucket: import.meta.env.MOTIA_MMEDIA_DRIVE_S3_BUCKET!,
      },
      { prefix: destinationKey }
    )
  ).includes(destinationKey)

  const readKey = processedExists ? destinationKey : sourceKey
  const mediaId = encodeURI(readKey).replaceAll('/', '_')
  const sourcePath = `./static/source/${mediaId}`
  const storageSourceKey = `source/${mediaId}`

  try {
    await ensureDir('./static/source')

    const { stream } = await s3GetFileStream(s3Drive, encodeURI(readKey), import.meta.env.MOTIA_MMEDIA_DRIVE_S3_ENDPOINT, import.meta.env.MOTIA_MMEDIA_DRIVE_S3_BUCKET)

    await stream.pipeTo(Writable.toWeb(createWriteStream(sourcePath)))

    const metadata = await getMediaMetadata(sourcePath)
    logger.info('Metadata extraction complete', { mediaKind: metadata.kind })

    // Webhook Notification: Phase 1 Complete (60%)
    await notifyDrive({ filename, projectId, status: 'processing', progressPercent: 60, error: null, data: { metadata } })

    if (!processedExists) {
      const fileBuffer = await fs.getItemRaw(storageSourceKey)
      const fileStream = Readable.toWeb(Readable.from(fileBuffer))

      await s3PutFileStream(s3Drive, destinationKey, fileStream, fileBuffer ? fileBuffer.byteLength : 0, {
        endpoint: import.meta.env.MOTIA_MMEDIA_DRIVE_S3_ENDPOINT,
        bucket: import.meta.env.MOTIA_MMEDIA_DRIVE_S3_BUCKET,
      })
    }

    // Webhook Notification: Phase 2 Complete (100%)
    await notifyDrive({ filename, projectId, status: 'completed', progressPercent: 100, error: null, data: null })

    // Remove the upload copy only after the callback succeeded, so a failed callback never leaves a processed file with no record
    await s3DriveStorage.del(sourceKey).catch((error_) => {
      logger.error('Failed to delete upload copy after processing', { sourceKey, error: error_.message })
    })
  } catch (error: any) {
    console.error(error)

    // Notify status webhook about processing failure
    await notifyDrive({
      filename,
      projectId,
      status: 'failed',
      progressPercent: 100,
      error: error.message || 'Processing execution pipeline error failed.',
      data: null,
    }).catch((error_) => {
      logger.error('Failed to notify status webhook about processing error state', { fetchErr: error_.message })
    })

    // Rethrow error so Motia can trigger configured retries or dead-letter queues
    throw error
  } finally {
    await fs.removeItem(storageSourceKey).catch(() => {})
  }
}
