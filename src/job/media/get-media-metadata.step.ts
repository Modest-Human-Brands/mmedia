import { enqueue, logger, queue, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import getImageMetadata from 'src/utils/get-image-metadata'
import getVideoMetadata from 'src/utils/get-video-metadata'
import getResolution from 'src/utils/get-resolution'
import getAspectRatio from 'src/utils/get-aspect-ratio'
import calculateDimension from 'src/utils/calculate-dimension'

export const config = {
  name: 'GetMediaMetaData',
  description: 'Extract metadata, resolution and aspect ratio for a saved media file',
  flows: ['media-upload-flow'],
  triggers: [
    queue('media.file.saved', {
      input: z.object({
        slug: z.string(),
        relPath: z.string(),
        mimeType: z.string(),
        size: z.number(),
        projectSlug: z.string(),
        traceId: z.string(),
      }),
    }),
  ],
  enqueues: ['media.file.metadata.extracted'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ slug, relPath, mimeType, size, projectSlug, traceId }) => {
  logger.info(`[${traceId}] Processing metadata`, { slug })

  const isImage = mimeType.startsWith('image/')
  const meta = isImage ? await getImageMetadata(relPath) : await getVideoMetadata(relPath)

  const originalWidth = 'stream' in meta ? meta.stream.width! : meta.format.width!
  const originalHeight = 'stream' in meta ? meta.stream.height! : meta.format.height!

  const resolutionLabel = getResolution(originalWidth, originalHeight)
  const aspectRatioLabel = getAspectRatio(originalWidth, originalHeight)
  const [aW, aH] = aspectRatioLabel.split(':').map(Number)
  const aspectRatio = aW / aH

  const { width: coverWidth, height: coverHeight } = calculateDimension(1080, aspectRatio)

  const duration = isImage ? undefined : (meta as Awaited<ReturnType<typeof getVideoMetadata>>).format.duration

  logger.info(`[${traceId}] Metadata extracted`, { slug, resolutionLabel, aspectRatioLabel })

  await enqueue({
    topic: 'media.file.metadata.extracted',
    data: {
      slug,
      relPath,
      mimeType,
      size,
      projectSlug,
      traceId,
      originalWidth,
      originalHeight,
      resolutionLabel,
      aspectRatioLabel,
      aspectRatio: `${aW}:${aH}`,
      coverWidth,
      coverHeight,
      duration,
    },
  })

  return { status: 200, body: { success: true } }
}
