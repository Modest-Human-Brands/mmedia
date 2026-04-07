import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import syncDrive from 'src/utils/sync-drive'

export const config = {
  name: 'MediaAllGet',
  description: 'Get all Media',
  flows: ['media-get-flow'],
  triggers: [
    http('GET', '/media', {
      responseSchema: { 200: z.array(z.object({ slug: z.string(), type: z.string() })) },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_) => {
  try {
    logger.info('🔄 Syncing Drive', { url: import.meta.env.MOTIA_DRIVE_R2_PUBLIC_URL })
    const data = await syncDrive()

    const result = Object.entries(data)
      .filter(([key, value]) => value.includes('uploads/1/media/') && !value.includes('uploads/1/media/archive') && (key.startsWith('photo-') || key.startsWith('video-')))
      .map<MediaItem>(([key, value]) => ({
        slug: key,
        type: key.startsWith('photo-') ? 'photo' : 'video',
        title: key,
        thumbnailUrl: `${import.meta.env.MOTIA_DRIVE_R2_PUBLIC_URL}/${value}._thumb`,
        metadata: {
          size: 22,
          bitDepth: '10 bit',
          resolution: '1080p',
          fps: key.startsWith('photo-') ? undefined : 30,
        },
      }))

    return {
      status: 200,
      body: result,
    }
  } catch (error) {
    console.error('API media GET', error)

    throw new Error(
      JSON.stringify({
        statusCode: 500,
        statusMessage: 'Some Unknown Error Found',
      })
    )
  }
}
