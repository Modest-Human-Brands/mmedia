import { enqueue, http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { RoomServiceClient } from 'livekit-server-sdk'

// Initialize the RoomClient for administrative actions
const roomClient = new RoomServiceClient(import.meta.env.MOTIA_LIVEKIT_URL, import.meta.env.MOTIA_LIVEKIT_API_KEY, import.meta.env.MOTIA_LIVEKIT_API_SECRET)

export const config = {
  name: 'StreamStop',
  description: 'Stop a live stream by deleting the LiveKit Room',
  flows: ['stream-flow'],
  triggers: [
    http('POST', '/stream/stop', {
      bodySchema: z.object({ slug: z.string(), deviceId: z.string() }),
      responseSchema: {
        200: z.object({ stopped: z.boolean(), slug: z.string(), deviceId: z.string() }),
        400: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: ['stream.stopped'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ request }) => {
  const { slug, deviceId } = request.body
  const roomName = `${slug}_${deviceId}`

  if (!slug || !deviceId) {
    return { status: 400, body: { error: 'slug and deviceId required' } }
  }

  try {
    // 1. Delete the room in LiveKit
    // This forcibly disconnects all publishers and subscribers
    await roomClient.deleteRoom(roomName)

    logger.info(`LiveKit Room deleted: ${roomName}`)

    // 2. Emit event for downstream processing (e.g., closing DB records)
    await enqueue({ topic: 'stream.stopped', data: { slug, deviceId } })

    return {
      status: 200,
      body: { stopped: true, slug, deviceId },
    }
  } catch (error: any) {
    // LiveKit throws an error if the room is not found
    if (error?.message?.includes('not found')) {
      return {
        status: 404,
        body: { error: `No active room found for ${roomName}` },
      }
    }

    logger.error(`Failed to stop LiveKit room ${roomName}:`, error)
    return {
      status: 400,
      body: { error: 'Internal server error while stopping stream' },
    }
  }
}
