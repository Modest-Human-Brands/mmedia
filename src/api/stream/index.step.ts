import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { streamSchema, StreamStatus } from './[id].step'
import { RoomServiceClient } from 'livekit-server-sdk'

const LIVEKIT_HOST = `https://${import.meta.env.MOTIA_LIVEKIT_URL}`
const API_KEY = import.meta.env.MOTIA_LIVEKIT_API_KEY
const API_SECRET = import.meta.env.MOTIA_LIVEKIT_API_SECRET

const roomService = new RoomServiceClient(LIVEKIT_HOST, API_KEY, API_SECRET)

export const config = {
  name: 'StreamAllStatus',
  description: 'List all active streams from OME',
  flows: ['stream-flow'],
  triggers: [
    http('GET', '/stream', {
      responseSchema: {
        200: streamSchema,
      },
      middleware: [],
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_req) => {
  const rooms = await roomService.listRooms()

  const streams = await Promise.all(
    rooms.map(async (room) => {
      const [slug, deviceId] = room.name.split('_')

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
        streamUrl: room.name,
        media: `https://${LIVEKIT_HOST}/rooms/${room.name}`,
      }
    })
  )

  logger.info(`Active LiveKit Rooms: ${streams.map((s) => `${s.slug} - ${s.status}`).join(', ')}`)

  return { status: 200, body: streams }
}
