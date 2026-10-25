import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { Writable } from 'node:stream'

import ensureDir from 'src/utils/ensure-dir'
import getMediaMetadata from 'src/utils/get-media-metadata'
import r2Drive from 'src/utils/r2-drive'
import r2GetAllFiles from 'src/utils/r2-get-all-files'
import r2GetFileStream from 'src/utils/r2-get-file-stream'
import requireApiKey from 'src/utils/require-api-key'

const THUMBNAIL_SIZE = '400x400'

const mediaSchema = z.object({
  slug: z.string(),
  type: z.enum(['photo', 'video', 'audio']),
  title: z.string(),
  thumbnailUrl: z.string(),
  metadata: z.object({
    size: z.number(),
    bitDepth: z.union([z.string(), z.number()]).optional(),
    resolution: z.string().optional(),
    aspectRatio: z.string().optional(),
    fps: z.number().optional(),
    camera: z.string().optional(),
    lens: z.string().optional(),
    location: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
  }),
})

export const config = {
  name: 'MediaGet',
  description: 'Get a single processed media item by id (filename without extension) with full EXIF/Metadata. Requires the x-org-id header',
  flows: ['media-get-flow'],
  triggers: [
    http('GET', '/media/:mediaId/metadata', {
      middleware: [requireApiKey],
      responseSchema: {
        200: mediaSchema,
        400: z.object({ error: z.string() }),
        401: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
        500: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ request }) => {
  const { mediaId } = request.pathParams

  const header = Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'x-org-id')?.[1]
  const orgId = Array.isArray(header) ? header[0] : header
  if (!orgId || !/^[\w-]+$/.test(orgId)) {
    return { status: 400, body: { error: 'x-org-id header required' } }
  }

  logger.info('Fetching media', { mediaId, orgId })

  let localPath: string | undefined

  try {
    const keys = await r2GetAllFiles(
      r2Drive,
      {
        endpoint: import.meta.env.MOTIA_DRIVE_R2_ENDPOINT!,
        bucket: import.meta.env.MOTIA_DRIVE_R2_BUCKET!,
      },
      { prefix: `processed/${orgId}/` }
    )

    // processed/<orgId>/<projectId>/<mediaId>.<ext>
    const key = keys.find((k) => {
      const filename = k.split('/').pop() || ''
      const dotIndex = filename.lastIndexOf('.')
      return (dotIndex > 0 ? filename.slice(0, dotIndex) : filename) === mediaId
    })

    if (!key) return { status: 404, body: { error: `Media not found: ${mediaId}` } }

    const ext = key.slice(key.lastIndexOf('.'))
    localPath = `./static/metadata/${mediaId}${ext}`

    await ensureDir('./static/metadata')
    const { stream } = await r2GetFileStream(r2Drive, encodeURI(key), import.meta.env.MOTIA_DRIVE_R2_ENDPOINT, import.meta.env.MOTIA_DRIVE_R2_BUCKET)
    await stream.pipeTo(Writable.toWeb(createWriteStream(localPath)))

    const { kind, format, stream: mediaStream } = await getMediaMetadata(localPath)

    return {
      status: 200,
      body: {
        slug: mediaId,
        type: kind,
        title: mediaId,
        thumbnailUrl: `${import.meta.env.MOTIA_SITE_URL}/media/image/s_${THUMBNAIL_SIZE}/${mediaId}`,
        metadata: {
          size: format.size,
          bitDepth: format.bitDepth,
          resolution: format.resolution,
          aspectRatio: format.aspectRatio,
          fps: mediaStream?.frameRate,
          camera: format.camera,
          lens: format.lens,
          location: format.location,
        },
      },
    }
  } catch (error) {
    logger.error('Failed to extract media metadata', { error })
    return {
      status: 500,
      body: { error: 'Internal Server Error while extracting metadata' },
    }
  } finally {
    if (localPath) await rm(localPath, { force: true }).catch(() => {})
  }
}
