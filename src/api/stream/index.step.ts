import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { streamSchema, StreamStatus } from './[id].step'
import { $fetch } from 'ofetch'
import { getSrtUrl, getHlsUrl } from './start.step'

export const OME_API_HOST = `${import.meta.env.MOTIA_OME_API_PROTOCOL}://${import.meta.env.MOTIA_OME_HOST}:${import.meta.env.MOTIA_OME_API_PORT}/v1`
export const OME_API_AUTH = { Authorization: `Basic ${btoa(import.meta.env.MOTIA_OME_API_KEY as string)}` }

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
  const streamNames = (await $fetch<{ response: string[] }>(`${OME_API_HOST}/vhosts/default/apps/live/streams`, { headers: OME_API_AUTH })).response

  const streams = await Promise.all(
    streamNames.map(async (name) => {
      const [slug, deviceId] = name.split('_')

      const { connections } = (await $fetch<{ response: { connections: { srt: number } } }>(`${OME_API_HOST}/stats/current/vhosts/default/apps/live/streams/${name}`, { headers: OME_API_AUTH }))
        .response

      let status = StreamStatus.Idle
      status = connections.srt >= 0 ? StreamStatus.Live : StreamStatus.Starting

      return { slug, deviceId, status, streamUrl: getSrtUrl(slug, deviceId), media: getHlsUrl(slug, deviceId) }
    })
  )

  logger.info(`Active streams: ${streams.map((s) => `${s.slug} - ${s.status}`).join(', ')}`)

  return { status: 200, body: streams }
}
