import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { streamSchema, StreamStatus } from './[id].step'
import { RoomServiceClient } from 'livekit-server-sdk'
import getHlsUrl from 'src/utils/get-hls-url'

const roomService = new RoomServiceClient(import.meta.env.MOTIA_LIVEKIT_URL, import.meta.env.MOTIA_LIVEKIT_API_KEY, import.meta.env.MOTIA_LIVEKIT_API_SECRET)

export const config = {
  name: 'StreamAllStatus',
  description: 'List all active streams from OME',
  flows: ['stream-flow'],
  triggers: [
    http('GET', '/stream', {
      responseSchema: {
        200: z.array(streamSchema),
        502: z.object({ error: z.string() }),
      },
      middleware: [],
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req) => {
  try {
    const rooms = await roomService.listRooms()

    const streams = rooms
      .filter((room) => room.name.includes('_'))
      .map((room) => {
        // Room name is `${slug}_${deviceId}`; the deviceId is everything after the last underscore
        const separator = room.name.lastIndexOf('_')
        const slug = room.name.slice(0, separator)
        const deviceId = room.name.slice(separator + 1)

        let status = StreamStatus.Idle
        if (room.numParticipants > 0) {
          status = StreamStatus.Live
        } else if (room.creationTime > 0) {
          status = StreamStatus.Starting
        }

        return {
          slug,
          deviceId,
          status,
          streamUrl: '',
          media: getHlsUrl(slug, deviceId),
        }
      })

    logger.info(`Active LiveKit Rooms: ${streams.map((s) => `${s.slug} - ${s.status}`).join(', ')}`)

    return { status: 200, body: streams }
  } catch (error) {
    logger.error('Failed to list LiveKit rooms', { error })
    return { status: 502, body: { error: 'Stream service unavailable' } }
  }
}
