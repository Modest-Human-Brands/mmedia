import { http, enqueue, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { $fetch } from 'ofetch'

export const config = {
  name: 'WebhookHandler',
  description: 'Intercepts Cloudflare R2 object creation notifications and dispatches tasks',
  flows: ['media-process-flow'],
  triggers: [
    http('POST', 'webhook/media/uploads', {
      bodySchema: z.object({ Records: z.array(z.object({ s3: z.any() })) }),
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

  const [, orgId, projectId, filenameWithExt = ''] = key.split('/')

  const dotIndex = filenameWithExt.lastIndexOf('.')
  const nameWithoutExt = dotIndex > 0 ? filenameWithExt.slice(0, dotIndex) : filenameWithExt
  const ext = dotIndex > 0 ? filenameWithExt.slice(dotIndex) : ''

  const parts = nameWithoutExt.split('-')
  const [batchId = '', uploadId = ''] = parts.slice(-2)
  const originalNameClean = parts.slice(0, -2).join('-')
  const filename = `${originalNameClean}${ext}`

  try {
    // Notify the central state webhook that the file was caught and verification processing has begun
    await $fetch('/webhook/uploads/status', {
      baseURL: import.meta.env.MOTIA_DRIVE_URL,
      method: 'PUT',
      body: {
        batchId,
        projectId,
        uploadId,
        filename,
        status: 'processing',
        progressPercent: 20,
        mediaId: null,
        error: null,
        data: null,
      },
    })
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
      uploadId,
      batchId,
    },
  })

  logger.info('Successfully handed off file upload to background queues extraction step', { uploadId })

  return {
    status: 202,
    body: { success: true, message: 'Dispatched optimization request' },
  }
}
