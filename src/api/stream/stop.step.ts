import { enqueue, http, logger, type Handlers, type StepConfig } from 'motia'
import { $fetch } from 'ofetch'
import { z } from 'zod'
import { OME_API_HOST, OME_API_AUTH } from './index.step'

export const config = {
  name: 'StreamStop',
  description: 'Stop a live stream via OME REST API',
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

  if (!slug || !deviceId) return { status: 400, body: { error: 'slug and deviceId required' } }

  const data = await $fetch(`${OME_API_HOST}/vhosts/default/apps/live/streams/${slug}_${deviceId}`, { method: 'DELETE', headers: OME_API_AUTH })
  const stopped = data !== null

  if (!stopped) {
    return { status: 404, body: { error: `No active stream found for ${slug}_${deviceId}` } }
  }

  logger.info(`Stream stopped: ${slug}_${deviceId}`)

  await enqueue({ topic: 'stream.stopped', data: { slug, deviceId } })

  return { status: 200, body: { stopped: true, slug, deviceId } }
}
