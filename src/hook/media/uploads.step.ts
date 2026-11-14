import { http, enqueue, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import notifyDrive from 'src/utils/notify-drive'
import requireApiKey from 'src/utils/require-api-key'

export const config = {
  name: 'WebhookHandler',
  description: 'Intercepts Cloudflare R2 object creation notifications and dispatches tasks',
  flows: ['media-process-flow'],
  triggers: [
    http('POST', '/webhook/media/uploads', {
      bodySchema: z.object({ Records: z.array(z.object({ s3: z.any() })) }),
      middleware: [requireApiKey],
      responseSchema: {
        401: z.object({ error: z.string() }),
        202: z.object({ success: z.boolean(), message: z.string(), ignored: z.boolean().optional() }),
        400: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: ['media.process'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ request }) => {
  const body = request.body as {
    Records: {
      s3: {
        bucket: {
          name: string
        }
        object: {
          key: string
          size: number
        }
      }
    }[]
  }

  const record = body?.Records?.[0]
  if (!record) {
    return { status: 400, body: { error: 'Invalid or missing S3/R2 Records payload' } }
  }

  const bucketName = record.s3.bucket.name
  const key = record.s3.object.key

  // Only react to uploads: writes under processed/ (our own output) must not re-trigger the pipeline
  const [prefix, orgId, projectId, filename] = key.split('/')
  if (prefix !== 'upload') {
    logger.info('Ignoring object outside upload/', { key })
    return { status: 202, body: { success: true, ignored: true, message: 'Ignored: not an upload key' } }
  }

  if (!orgId || !projectId || !filename) {
    return { status: 400, body: { error: 'Key must be upload/<orgSlug>/<projectKey>/<name>.<ext>' } }
  }

  try {
    // Notify the central state webhook that the file was caught and verification processing has begun
    await notifyDrive({ filename, projectId, status: 'processing', progressPercent: 20, error: null, data: null })
  } catch (error_: any) {
    logger.error('Failed to notify status webhook about initial processing entry state', { error: error_.message })
  }

  // Push job securely to Motia Queue for the worker thread to take over
  await enqueue({
    topic: 'media.process',
    data: {
      bucket: bucketName,
      sourceKey: key,
      orgId,
      projectId,
      filename,
    },
  })

  logger.info('Successfully handed off file upload to background queues extraction step', { filename })

  return {
    status: 202,
    body: { success: true, message: 'Dispatched optimization request' },
  }
}
