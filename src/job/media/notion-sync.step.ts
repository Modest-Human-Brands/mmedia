import { queue, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'

export const config = {
  name: 'MediaNotionSync',
  description: 'Create a Notion asset page from processed media metadata',
  flows: ['media-upload-flow'],
  triggers: [
    queue('media.file.metadata.extracted', {
      input: z.object({
        slug: z.string(),
        mimeType: z.string(),
        size: z.number(),
        projectSlug: z.string(),
        traceId: z.string(),
        resolutionLabel: z.string(),
        aspectRatio: z.string(),
        coverWidth: z.number(),
        coverHeight: z.number(),
        duration: z.number().optional(),
      }),
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ slug, projectSlug, resolutionLabel, aspectRatio, coverWidth, coverHeight, duration, traceId }, { logger }) => {
  logger.info(`[${traceId}] Syncing to Notion`, { slug })

  const projects = await notionQueryDb<NotionProject>(notion, notionDbId.project)
  const projectId = projects.find(({ properties }) => properties.Slug.formula.string === projectSlug)?.id

  if (!projectId) {
    logger.error(`[${traceId}] Project not found`, { projectSlug })
    return
  }

  const [slugKind, , assetIndexStr, versionIndexStr] = slug.split('-')
  const kind = slugKind === 'video' ? 'Video' : 'Photo'
  const [aW, aH] = aspectRatio.split(':').map(Number)
  const coverURL = `${process.env.MOTIA_SITE_URL}/media/image/s_${coverWidth}x${coverHeight}/${slug}`

  await notion.pages.create({
    parent: { database_id: notionDbId.asset },
    cover: { type: 'external', external: { url: coverURL } },
    properties: {
      Name: { title: [{ type: 'text', text: { content: slug } }] },
      Project: { relation: [{ id: projectId }] },
      Index: { number: Number.parseInt(assetIndexStr, 10) },
      'Version Index': { number: Number.parseInt(versionIndexStr, 10) },
      Type: { select: { name: kind } },
      Status: { status: { name: 'Plan' } },
      Resolution: { select: { name: resolutionLabel } },
      'Aspect ratio': { select: { name: `${aW}:${aH}` } },
      ...(duration !== undefined && {
        Additional: {
          rich_text: [{ text: { content: JSON.stringify({ duration }) } }],
        },
      }),
    },
  })

  logger.info(`[${traceId}] Notion page created`, { slug, coverURL })

  return { status: 200, body: { success: true } }
}
