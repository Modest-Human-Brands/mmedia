import { logger, queue, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'

export const config = {
  name: 'StreamUpload',
  description: 'Upload Stream to R2 Bucket',
  flows: ['stream-flow'],
  triggers: [
    queue('stream.processed', {
      input: z.object({ path: z.string(), file: z.string() }),
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ file, path }) => {
  if (!path || !file) throw new Error('Missing path or file')

  logger.info(`Uploading ${path}, ${file}`)

  return {
    status: 200,
    body: { status: 'uploaded' },
  }
}
