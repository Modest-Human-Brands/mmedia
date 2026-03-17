import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import resolveStreamStatus from 'src/utils/resolve-stream-status'
import { getSrtUrl, getHlsUrl } from './start.step'

export enum StreamStatus {
  Idle = 'idle', // registered, nothing started
  Starting = 'starting', // FFmpeg spawning, waiting for SRT connection
  Live = 'live', // SRT connected, actively encoding
  Paused = 'paused', // stream paused, FFmpeg still running
  Stopping = 'stopping', // SIGTERM sent, flushing buffers
  Stopped = 'stopped', // FFmpeg exited cleanly (code 0)
  Error = 'error', // FFmpeg exited with non-zero code
  Processing = 'processing', // post-stream: remux / R2 upload in progress
  Ready = 'ready', // processing done, VOD available
}

export const streamSchema = z.object({
  slug: z.string(),
  deviceId: z.string(),
  status: z.enum(StreamStatus),
  streamUrl: z.string(),
  media: z.string(),
})

export const config = {
  name: 'StreamStatus',
  description: 'Get a single HLS stream by slug and deviceId',
  flows: ['stream-flow'],
  triggers: [
    http('GET', '/stream/:slug/:deviceId', {
      responseSchema: {
        200: streamSchema,
        404: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ request }) => {
  const { slug, deviceId } = request.pathParams

  if (!slug || !deviceId) {
    return { status: 404, body: { error: 'slug and deviceId are required' } }
  }

  const status = await resolveStreamStatus(slug, deviceId)

  logger.info(`Stream ${slug}_${deviceId} → ${status}`)

  return {
    status: 200,
    body: {
      slug: `${slug}_${deviceId}`,
      status,
      streamUrl: getSrtUrl(slug, deviceId),
      media: getHlsUrl(slug, deviceId),
    },
  }
}
