import { http, logger, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import {
  IngressClient,
  IngressInput,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  SegmentedFileOutput,
  SegmentedFileProtocol,
  EncodingOptionsPreset,
  EncodingOptions,
  S3Upload,
} from 'livekit-server-sdk'
import { AwsClient } from 'aws4fetch'
import { StreamStatus } from './[id].step'

const livekitUrl = import.meta.env.MOTIA_LIVEKIT_URL
const apiKey = import.meta.env.MOTIA_LIVEKIT_API_KEY
const apiSecret = import.meta.env.MOTIA_LIVEKIT_API_SECRET

const r2Bucket = import.meta.env.MOTIA_CDN_R2_BUCKET
const r2Region = import.meta.env.MOTIA_CDN_R2_REGION
const r2AccessKey = import.meta.env.MOTIA_CDN_R2_ACCESS_KEY_ID
const r2Secret = import.meta.env.MOTIA_CDN_R2_SECRET_ACCESS_KEY

const ingressClient = new IngressClient(livekitUrl, apiKey, apiSecret)
const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret)

// aws4fetch client — used only for manual S3 uploads (master.m3u8)
const aws = new AwsClient({
  accessKeyId: r2AccessKey,
  secretAccessKey: r2Secret,
  region: r2Region,
  service: 'r2',
})

// Reused across all LiveKit egress outputs
function makeS3Upload(): S3Upload {
  return new S3Upload({
    accessKey: r2AccessKey,
    secret: r2Secret,
    bucket: r2Bucket,
    region: r2Region,
    // Uncomment if using R2 / MinIO:
    // endpoint: import.meta.env.MOTIA_S3_ENDPOINT,
    // forcePathStyle: true,
  })
}

export function getHlsUrl(slug: string): string {
  const cdnBase = import.meta.env.MOTIA_CDN_HOST
  return `${cdnBase}/live/${slug}/hls/master.m3u8`
}

// ─── HLS quality ladder ───────────────────────────────────────────────────────
const HLS_QUALITIES = [
  {
    label: '480p',
    advanced: new EncodingOptions({
      width: 854,
      height: 480,
      framerate: 30,
      videoBitrate: 1500,
      audioBitrate: 128,
    }),
    bandwidth: 1_500_000,
    resolution: '854x480',
  },
  {
    label: '720p',
    preset: EncodingOptionsPreset.H264_720P_30,
    bandwidth: 3_000_000,
    resolution: '1280x720',
  },
  {
    label: '1080p',
    preset: EncodingOptionsPreset.H264_1080P_30,
    bandwidth: 4_500_000,
    resolution: '1920x1080',
  },
] as const

export const config = {
  name: 'StreamStart',
  description: 'Create a LiveKit Ingress, start MP4 + multi-quality HLS egress, upload master.m3u8 to S3',
  flows: ['stream-flow'],
  triggers: [
    http('POST', '/stream/start', {
      bodySchema: z.object({ slug: z.string(), deviceId: z.string() }),
      responseSchema: {
        200: z.object({
          slug: z.string(),
          deviceId: z.string(),
          status: z.enum(['idle', 'starting', 'live', 'paused', 'stopping', 'stopped', 'error', 'processing', 'ready']),
          streamUrl: z.string(),
          streamKey: z.string(),
          token: z.string(),
          media: z.string(),
        }),
        400: z.object({ error: z.string() }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async ({ request }) => {
  const { slug, deviceId } = request.body

  if (!slug || !deviceId) {
    return { status: 400, body: { error: 'slug and deviceId required' } }
  }

  try {
    // ── 1. Create LiveKit Ingress ─────────────────────────────────────────────
    const ingress = await ingressClient.createIngress(IngressInput.WHIP_INPUT, {
      roomName: slug,
      participantIdentity: `${slug}_${deviceId}_publisher`,
    })

    // ── 2. Raw MP4 egress → S3 ───────────────────────────────────────────────
    const sequence = Math.floor(Date.now() / 1000)
    const rawMp4Key = `recordings/${slug}/raw_${sequence}.mp4`

    const mp4Egress = egressClient.startRoomCompositeEgress(slug, {
      file: new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: rawMp4Key,
        output: { case: 's3', value: makeS3Upload() },
      }),
    })

    const hlsEgresses = HLS_QUALITIES.map(({ label, bandwidth, resolution, ...encoding }) => {
      const segmentOutput = new SegmentedFileOutput({
        protocol: SegmentedFileProtocol.HLS_PROTOCOL,
        filenamePrefix: `live/${slug}/hls/${label}/seg`,
        playlistName: 'index.m3u8',
        livePlaylistName: 'live.m3u8',
        segmentDuration: 4,
        output: { case: 's3', value: makeS3Upload() },
      })
      return egressClient.startRoomCompositeEgress(slug, {
        segments: segmentOutput,
      })
    })

    // ── 4. Upload master.m3u8 to S3 via aws4fetch ─────────────────────────────
    const cdnBase = import.meta.env.MOTIA_CDN_HOST
    const masterPlaylist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '',
      ...HLS_QUALITIES.map(({ label, bandwidth, resolution }) => `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}\n${cdnBase}/live/${slug}/hls/${label}/index.m3u8`),
    ].join('\n')

    const masterKey = `live/${slug}/hls/master.m3u8`
    const masterUpload = aws.fetch(`https://${r2Bucket}.r2.${r2Region}.amazonaws.com/${masterKey}`, {
      method: 'PUT',
      body: masterPlaylist,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache', // master.m3u8 should never be CDN-cached
      },
    })

    // Fire everything at once
    const [rawResult, ...hlsAndMaster] = await Promise.all([mp4Egress, ...hlsEgresses, masterUpload])

    const hlsResults = hlsAndMaster.slice(0, HLS_QUALITIES.length)

    logger.info(`Raw MP4 egress started: ${rawResult.egressId} → r2://${r2Bucket}/${rawMp4Key}`)
    for (const [i, r] of hlsResults.entries()) {
      logger.info(`HLS ${HLS_QUALITIES[i]!.label} egress started: ${(r as Awaited<ReturnType<typeof egressClient.startRoomCompositeEgress>>).egressId}`)
    }
    logger.info(`master.m3u8 uploaded → r2://${r2Bucket}/${masterKey}`)

    return {
      status: 200,
      body: {
        slug,
        deviceId,
        status: StreamStatus.Starting,
        streamUrl: ingress.url ?? '',
        streamKey: ingress.streamKey ?? '',
        media: getHlsUrl(slug),
      },
    }
  } catch (error) {
    logger.error('Failed to start stream with LiveKit:', error)
    return { status: 400, body: { error: 'Could not initialize stream session' } }
  }
}
