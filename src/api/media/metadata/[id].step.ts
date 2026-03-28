import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import syncDrive from 'src/utils/sync-drive'

const mediaSchema = z.object({
  slug: z.string(),
  type: z.enum(['photo', 'video']),
  title: z.string(),
  thumbnailUrl: z.string(),
  metadata: z.object({
    size: z.number(),
    bitDepth: z.string(),
    resolution: z.string(),
    fps: z.number().optional(),
  }),
})

export const config = {
  name: 'MediaGet',
  description: 'Get a single media item by slug',
  flows: ['media-get-flow'],
  triggers: [
    http('GET', '/media/:slug', {
      responseSchema: {
        200: mediaSchema,
        404: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ request }) => {
  const { slug } = request.pathParams

  logger.info('Fetching media', { slug })

  const data = await syncDrive()
  const entry = Object.entries(data).find(([key]) => key === slug)

  if (!entry) return { status: 404, body: { error: `Media not found: ${slug}` } }

  const [key, value] = entry

  return {
    status: 200,
    body: {
      slug: key,
      type: key.startsWith('video-') ? 'video' : 'photo',
      title: key,
      thumbnailUrl: `${import.meta.env.MOTIA_DRIVE_R2_PUBLIC_URL}/${value}._thumb`,
      metadata: {
        size: 22,
        bitDepth: '10 bit',
        resolution: '1080p',
        fps: key.startsWith('video-') ? 30 : undefined,
      },
    },
  }
}
