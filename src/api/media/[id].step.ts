import { enqueue, type Handlers, http, type StepConfig } from 'motia'
import { z } from 'zod'
/**
 * Motia Step Configuration
 */
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
} as const satisfies StepConfig

/**
 * Step Handler
 */
export const handler: Handlers<typeof config> = async ({ request }) => {
  const { taskType, payload } = request.body

  await enqueue({
    topic: 'media.transform',
    data: {
      taskType,
      payload,
    },
  })

  return { status: 200, body: { status: 'process started' } }
}
