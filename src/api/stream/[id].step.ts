import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { RoomServiceClient } from 'livekit-server-sdk'
import { getHlsUrl } from './start.step'

const roomService = new RoomServiceClient(import.meta.env.MOTIA_LIVEKIT_URL, import.meta.env.MOTIA_LIVEKIT_API_KEY, import.meta.env.MOTIA_LIVEKIT_API_SECRET)

export enum StreamStatus {
  Idle = 'idle',
  Starting = 'starting',
  Live = 'live',
  Paused = 'paused',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Error = 'error',
  Processing = 'processing',
  Ready = 'ready',
}

export const streamSchema = z.object({
  slug: z.string(),
  deviceId: z.string(),
  status: z.enum(StreamStatus as any),
  streamUrl: z.string(),
  media: z.string(),
})

export const config = {
  name: 'StreamStatus',
  description: 'Get a single LiveKit room status by slug and deviceId',
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
  const roomName = `${slug}_${deviceId}`

  try {
    const rooms = await roomService.listRooms([roomName])
    const room = rooms.find((r) => r.name === roomName)

    let status = StreamStatus.Idle

    if (room) {
      if (room.numParticipants > 0) {
        status = StreamStatus.Live
      } else {
        status = StreamStatus.Starting
      }
    } else {
      status = StreamStatus.Stopped
    }

    logger.info(`LiveKit Room ${roomName} → ${status}`)

    return {
      status: 200,
      body: {
        slug: roomName,
        status,
        streamUrl: '', //getSrtUrl(slug, deviceId),
        media: getHlsUrl(slug, deviceId),
      },
    }
  } catch (error_) {
    logger.error(`Failed to fetch room status: ${error_}`)
    return { status: 404, body: { error: 'Stream not found or service unavailable' } }
  }
}
