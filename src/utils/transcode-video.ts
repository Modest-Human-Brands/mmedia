import { execa } from 'execa'
import path from 'node:path'

interface ResolutionVariant {
  height: number
  videoBitrate: string // Base bitrate for this resolution
}

interface AudioVariant {
  bitrate: string
  channels: number
}

const SEGMENT_DURATION = 4
const FPS = 30
const GOP_SIZE = FPS * SEGMENT_DURATION

const CODECS = [
  { name: 'av1', ffmpegCodec: 'libsvtav1', ext: 'av1' },
  { name: 'hevc', ffmpegCodec: 'libx265', ext: 'hevc' },
  { name: 'vp9', ffmpegCodec: 'libvpx-vp9', ext: 'vp9' },
  { name: 'avc', ffmpegCodec: 'libx264', ext: 'avc' },
]

const VIDEO_VARIANTS: ResolutionVariant[] = [
  { height: 1920, videoBitrate: '3500k' },
  { height: 1080, videoBitrate: '2000k' },
  { height: 720, videoBitrate: '1200k' },
]
const AUDIO_VARIANTS: AudioVariant[] = [
  { bitrate: '192k', channels: 2 },
  { bitrate: '128k', channels: 2 },
]

export default async function (filePath: string, outputDir: string) {
  if (!filePath || typeof filePath !== 'string') throw new Error('Invalid filePath')

  const absoluteFilePath = path.resolve(filePath)
  const outputName = path.basename(filePath.split('_').at(-1)!, path.extname(filePath))

  const ffmpegArgs: string[] = ['-y', '-i', absoluteFilePath]

  const filterComplex: string[] = []

  for (const variant of VIDEO_VARIANTS) {
    const scaleOutLabel = `vscale_${variant.height}`

    const scaleFilter = `[0:v]scale=trunc(oh*a/2)*2:${variant.height}:flags=lanczos,fps=${FPS}[${scaleOutLabel}]`
    filterComplex.push(scaleFilter)

    const splitOutputs = CODECS.map((c) => `[v${variant.height}_${c.name}]`).join('')
    filterComplex.push(`[${scaleOutLabel}]split=${CODECS.length}${splitOutputs}`)
  }

  ffmpegArgs.push('-filter_complex', filterComplex.join(';'))

  let outputStreamIndex = 0

  for (const variant of VIDEO_VARIANTS) {
    for (const codec of CODECS) {
      const currentIdx = outputStreamIndex
      const inputLabel = `[v${variant.height}_${codec.name}]`

      ffmpegArgs.push('-map', inputLabel)

      ffmpegArgs.push(
        `-c:v:${currentIdx}`,
        codec.ffmpegCodec,
        `-g:v:${currentIdx}`,
        `${GOP_SIZE}`,
        `-keyint_min:v:${currentIdx}`,
        `${GOP_SIZE}`,
        `-sc_threshold:v:${currentIdx}`,
        '0',
        `-flags:v:${currentIdx}`,
        '+cgop'
      )

      if (codec.name === 'av1') {
        ffmpegArgs.push(`-crf:v:${currentIdx}`, '35', `-preset:v:${currentIdx}`, '8', `-svtav1-params:v:${currentIdx}`, `tune=0:enable-overlays=1:scm=0`)
      } else {
        const bufSize = `${Number.parseInt(variant.videoBitrate) * 2}k`
        ffmpegArgs.push(`-b:v:${currentIdx}`, variant.videoBitrate, `-maxrate:v:${currentIdx}`, variant.videoBitrate, `-bufsize:v:${currentIdx}`, bufSize)

        switch (codec.name) {
          case 'avc': {
            ffmpegArgs.push(`-profile:v:${currentIdx}`, 'high', `-preset:v:${currentIdx}`, 'medium')

            break
          }
          case 'hevc': {
            ffmpegArgs.push(`-tag:v:${currentIdx}`, 'hvc1', `-preset:v:${currentIdx}`, 'medium')

            break
          }
          case 'vp9': {
            ffmpegArgs.push(`-row-mt:v:${currentIdx}`, '1', `-deadline:v:${currentIdx}`, 'good', `-cpu-used:v:${currentIdx}`, '2')

            break
          }
        }
      }

      outputStreamIndex++
    }
  }

  for (const audioVar of AUDIO_VARIANTS) {
    const currentIdx = outputStreamIndex
    ffmpegArgs.push('-map', '0:a:0', `-c:a:${currentIdx}`, 'aac', `-b:a:${currentIdx}`, audioVar.bitrate, `-ac:a:${currentIdx}`, `${audioVar.channels}`, `-ar:a:${currentIdx}`, '48000')
    outputStreamIndex++
  }

  const adaptationSets: string[] = []

  for (const [codecIndex, _codec] of CODECS.entries()) {
    const streamIndices: number[] = []
    for (const [resIndex, _] of VIDEO_VARIANTS.entries()) {
      const streamId = codecIndex + resIndex * CODECS.length
      streamIndices.push(streamId)
    }

    adaptationSets.push(`id=${codecIndex},streams=${streamIndices.join(',')}`)
  }

  const audioIndices = AUDIO_VARIANTS.map((_, i) => 12 + i).join(',')
  adaptationSets.push(`id=${CODECS.length},streams=${audioIndices}`)

  const mpdFileName = `${outputName}.mpd`

  ffmpegArgs.push(
    '-f',
    'dash',
    '-seg_duration',
    `${SEGMENT_DURATION}`,
    '-use_timeline',
    '1',
    '-use_template',
    '1',
    '-adaptation_sets',
    adaptationSets.join(' '),
    '-init_seg_name',
    `${outputName}_$RepresentationID$_init.mp4`,
    '-media_seg_name',
    `${outputName}_$RepresentationID$_seg_$Number$.m4s`,
    mpdFileName
  )

  try {
    await execa('ffmpeg', ffmpegArgs, { cwd: outputDir })

    return {
      success: true,
      mpdFile: path.join(outputDir, mpdFileName),
      outputDir: outputDir,
    }
  } catch (error: unknown) {
    console.error('❌ FFmpeg failed:', error)
    throw error
  }
}
