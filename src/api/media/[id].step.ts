import { enqueue, stateManager, logger, type Handlers, http, type StepConfig } from 'motia'
import { z } from 'zod'

export const config = {
  name: 'MediaTransformer',
  description: 'Consolidated step for image and video transcoding',
  flows: ['media-transform-flow'],
  triggers: [
    http('POST', '/media', {
      bodySchema: z.object({
        taskType: z.enum(['transform:image', 'transform:video']),
        payload: z.object({
          cacheKey: z.string(),
          mediaOriginId: z.string(),
          modifiers: z.record(z.string(), z.string()),
        }),
      }),
    }),
  ],
  enqueues: ['media.transform'],
} as const satisfies StepConfig

const TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 300

export const handler: Handlers<typeof config> = async ({ request }, { traceId }) => {
  const { taskType, payload } = request.body

  await stateManager.set('media.result', traceId, { status: 'pending' })

  await enqueue({
    topic: 'media.transform',
    data: { taskType, payload, traceId },
  })

  const deadline = Date.now() + TIMEOUT_MS

  while (Date.now() < deadline) {
    const result = await stateManager.get<{
      status: string
      streamPath?: string
      contentType?: string
      byteLength?: number
    }>('media.result', traceId)

    if (result?.status === 'done') {
      await stateManager.delete('media.result', traceId) // cleanup
      return {
        status: 200,
        body: {
          streamPath: result.streamPath!,
          contentType: result.contentType!,
          byteLength: result.byteLength!,
        },
      }
    }

    if (result?.status === 'error') {
      await stateManager.delete('media.result', traceId)
      return { status: 500, body: { error: 'Media transform failed' } }
    }

    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS))
  }

  return { status: 504, body: { error: 'Timed out waiting for media transform' } }
}
