import { type Handlers, http, logger, type StepConfig } from 'motia'
import { z } from 'zod'
import mime from 'mime-types'
import { createWriteStream } from 'node:fs'
import { Writable } from 'node:stream'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

import transcodeImage from 'src/utils/transcode-image'
import transcodeVideo from 'src/utils/transcode-video'
import ensureDir from 'src/utils/ensure-dir'
import generateThumbnail from 'src/utils/generate-thumbnail'
import r2GetFileStream from 'src/utils/r2-get-file-stream'

/**
 * Motia Step Configuration
 */
export const config = {
  name: 'MediaTransformer',
  description: 'Consolidated step for image and video transcoding',
  flows: ['media-transform-flow'],
  triggers: [
    http('POST', '/media', {
      bodySchema: z.object({
        taskType: z.enum(['transform:image', 'transform:video']),
        payload: z.object({
          cacheKey: z.string(),
          mediaOriginId: z.string(),
          modifiers: z.record(z.string(), z.string()),
        }),
      }),
    }),
  ],
} as const satisfies StepConfig

const fs = createStorage({
  driver: fsDriver({ base: './static' }),
})

/**
 * Step Handler
 */
export const handler: Handlers<typeof config> = async ({ request }) => {
  const { taskType, payload } = request.body
  const { cacheKey, mediaOriginId, modifiers } = payload

  logger.debug(`[MediaTransformer] Starting task: ${taskType}`, { mediaOriginId, cacheKey })

  // 1. Prepare Paths and Source
  const mediaId = encodeURI(mediaOriginId).replaceAll('/', '_')
  const sourcePath = `./static/source/${mediaId}`
  const storageSourceKey = `source/${mediaId}`

  await ensureDir('./static/source')

  // 2. Ensure Source File Exists (Shared Logic)
  try {
    if (!(await fs.hasItem(storageSourceKey))) {
      logger.info(`[MediaTransformer] Downloading source from R2: ${mediaOriginId}`)

      const { stream } = await r2GetFileStream(encodeURI(mediaOriginId), 'origin', import.meta.env.MOTIA_DRIVE_R2_ENDPOINT, import.meta.env.MOTIA_DRIVE_R2_BUCKET)

      // Stream R2 content directly to local disk
      await stream.pipeTo(Writable.toWeb(createWriteStream(sourcePath)))
    }

    let finalStreamPath: string
    let contentType: string

    // 3. Execution Branching
    if (taskType === 'transform:image') {
      const mimeType = mime.lookup(sourcePath)
      const isVideoSource = typeof mimeType === 'string' && mimeType.startsWith('video/')

      let processingInput = sourcePath
      if (isVideoSource) {
        logger.info(`[MediaTransformer:Image] Extracting thumbnail from video source`)
        await ensureDir('./static/thumbnail')
        await generateThumbnail(sourcePath, './static/thumbnail', '00:00:00.500')
        processingInput = `./static/thumbnail/${mediaId.replace(/\.[^/.]+$/, '.jpg')}`
      }
      const data = await transcodeImage(processingInput, modifiers)

      // Ensure data is a Buffer and save to storage
      const fileBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data as any)
      await fs.setItemRaw(cacheKey, fileBuffer)

      finalStreamPath = `./static/${cacheKey}`
      contentType = (typeof modifiers.format === 'string' && mime.contentType(modifiers.format)) || 'image/jpeg'
    } else {
      // Video-specific logic
      const videoCachePath = `./static/cache/video`

      await ensureDir('./static/cache/video')
      await transcodeVideo(sourcePath, videoCachePath)

      finalStreamPath = videoCachePath
      contentType = (typeof modifiers.format === 'string' && mime.contentType(modifiers.format)) || 'video/mp4'
    }

    const metaData = await fs.getMeta(cacheKey)
    const response = {
      status: 200,
      body: {
        streamPath: finalStreamPath,
        contentType,
        byteLength: (metaData?.size as number) || 0,
      },
    }

    logger.info(`[MediaTransformer] Task successful`, response.body)
    return response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('VipsJpeg: premature end of JPEG image')) {
      logger.warn(`[MediaTransformer] Corrupted source detected. Purging: ${storageSourceKey}`)
      await fs.removeItem(storageSourceKey)
    }

    logger.error(`[MediaTransformer] Fatal error during transformation`, error)
    throw error // Let Motia handle the retry/failure logic
  } finally {
    // 4. Memory Management
    try {
      if (typeof Bun !== 'undefined') {
        Bun.gc()
      }
    } catch {
      // Ignore GC errors
    }
  }
}
