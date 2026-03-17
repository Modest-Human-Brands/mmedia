import { $fetch } from 'ofetch'
import { StreamStatus } from 'src/api/stream/[id].step'
import { OME_API_HOST, OME_API_AUTH } from 'src/api/stream/index.step'

export default async function (slug: string, deviceId: string): Promise<StreamStatus> {
  const data = await $fetch(`${OME_API_HOST}/vhosts/default/apps/live/streams/${slug}_${deviceId}`, { headers: OME_API_AUTH })
  const stream = data?.response ?? null
  if (!stream) return StreamStatus.Idle
  const hasVideo = stream.input?.tracks?.some((t: { type: string }) => t.type === 'video')
  return hasVideo ? StreamStatus.Live : StreamStatus.Starting
}
