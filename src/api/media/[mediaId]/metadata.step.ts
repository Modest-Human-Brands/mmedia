import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import syncDrive from 'src/utils/sync-drive'
import getMediaMetadata from 'src/utils/get-media-metadata' // Adjust path if needed

const mediaSchema = z.object({
  slug: z.string(),
  type: z.enum(['photo', 'video', 'audio']),
  title: z.string(),
  thumbnailUrl: z.string(),
  metadata: z.object({
    size: z.number(),
    bitDepth: z.union([z.string(), z.number()]).optional(),
    resolution: z.string().optional(),
    aspectRatio: z.string().optional(),
    fps: z.number().optional(),
    camera: z.string().optional(),
    lens: z.string().optional(),
    location: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
  }),
})

export const config = {
  name: 'MediaGet',
  description: 'Get a single media item by slug with full EXIF/Metadata',
  flows: ['media-get-flow'],
  triggers: [
    http('GET', '/media/:mediaId/metadata', {
      responseSchema: {
        200: mediaSchema,
        404: z.object({ error: z.string() }),
        500: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ request }) => {
  const { mediaId } = request.pathParams

  logger.info('Fetching media', { mediaId })

  try {
    const data = await syncDrive()
    const entry = Object.entries(data).find(([key]) => key === mediaId)

    if (!entry) return { status: 404, body: { error: `Media not found: ${mediaId}` } }

    const [key, filePath] = entry

    return {
      status: 200,
      body: {
        slug: key,
        type: metaInfo.kind,
        title: key,
        metadata: await getMediaMetadata(filePath),
      },
    }
  } catch (error) {
    logger.error('Failed to extract media metadata', { error })
    return {
      status: 500,
      body: { error: 'Internal Server Error while extracting metadata' },
    }
  }
}
