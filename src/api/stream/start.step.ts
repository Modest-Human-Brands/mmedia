import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { StreamStatus } from './[id].step'

export function getSrtUrl(slug: string, deviceId: string): string {
  return `srt://${import.meta.env.MOTIA_OME_HOST}:${import.meta.env.MOTIA_OME_SRT_PORT}?streamid=#default/live/${slug}_${deviceId}`
}

export function getHlsUrl(slug: string, deviceId: string): string {
  return `${import.meta.env.MOTIA_OME_API_PROTOCOL}://${import.meta.env.MOTIA_OME_HOST}:${import.meta.env.MOTIA_OME_HLS_PORT}/live/${slug}_${deviceId}/master.m3u8`
}

export const config = {
  name: 'StreamStart',
  description: 'Register a stream and return the SRT ingest URL for OME',
  flows: ['stream-flow'],
  triggers: [
    http('POST', '/stream/start', {
      bodySchema: z.object({ slug: z.string(), deviceId: z.string() }),
      responseSchema: {
        200: z.object({
          slug: z.string(),
          deviceId: z.string(),
          status: z.enum(['idle', 'starting', 'live', 'paused', 'stopping', 'stopped', 'error', 'processing', 'ready']),
          streamUrl: z.string(),
          media: z.string(),
        }),
        400: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ request }) => {
  const { slug, deviceId } = request.body

  if (!slug || !deviceId) return { status: 400, body: { error: 'slug and deviceId required' } }

  logger.info(`Stream registered: ${slug}/${deviceId} — push SRT to OME to go live`)

  return {
    status: 200,
    body: {
      slug,
      deviceId,
      status: StreamStatus.Starting,
      streamUrl: getSrtUrl(slug, deviceId),
      media: getHlsUrl(slug, deviceId),
    },
  }
}
