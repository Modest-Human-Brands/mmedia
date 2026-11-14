import { execa } from 'execa'
import { logger } from 'motia'
import path from 'node:path'

import { getFunctionalEncoders, logEncoders, markEncodersFailed } from './hw-encoders'

const SEGMENT_DURATION = 4
const FPS = 30
const GOP_SIZE = FPS * SEGMENT_DURATION

const VIDEO_VARIANTS = [
  { height: 1920, videoBitrate: '3500k' },
  { height: 1080, videoBitrate: '2000k' },
  { height: 720, videoBitrate: '1200k' },
]

const AUDIO_VARIANTS = [
  { bitrate: '192k', channels: 2 },
  { bitrate: '128k', channels: 2 },
]

const CODECS = [
  { name: 'av1', sw: 'libsvtav1', hw: ['av1_nvenc', 'av1_qsv'] },
  { name: 'hevc', sw: 'libx265', hw: ['hevc_nvenc', 'hevc_qsv'] },
  { name: 'vp9', sw: 'libvpx-vp9', hw: ['vp9_qsv'] },
  { name: 'avc', sw: 'libx264', hw: ['h264_nvenc', 'h264_qsv'] },
]

/** Builds the ffmpeg arguments for the given set of usable hardware encoders (empty set = software only). */
function buildArgs(absoluteFilePath: string, outputName: string, functionalHw: Set<string>) {
  const chosen: Record<string, string> = {}

  const ffmpegArgs: string[] = ['-y']

  // Use auto hardware accel for decoding if any HW encoders were found
  if (functionalHw.size > 0) ffmpegArgs.push('-hwaccel', 'auto')

  ffmpegArgs.push('-i', absoluteFilePath)

  const filterComplex: string[] = []
  for (const variant of VIDEO_VARIANTS) {
    const scaleOutLabel = `vscale_${variant.height}`
    filterComplex.push(`[0:v]scale=trunc(oh*a/2)*2:${variant.height}:flags=lanczos,fps=${FPS}[${scaleOutLabel}]`)
    const splitOutputs = CODECS.map((c) => `[v${variant.height}_${c.name}]`).join('')
    filterComplex.push(`[${scaleOutLabel}]split=${CODECS.length}${splitOutputs}`)
  }
  ffmpegArgs.push('-filter_complex', filterComplex.join(';'))

  let outputStreamIndex = 0

  for (const variant of VIDEO_VARIANTS) {
    for (const codec of CODECS) {
      const currentIdx = outputStreamIndex
      const inputLabel = `[v${variant.height}_${codec.name}]`

      const encoder = codec.hw.find((h) => functionalHw.has(h)) || codec.sw
      chosen[codec.name] = encoder
      const isNvenc = encoder.includes('nvenc')
      const isQsv = encoder.includes('qsv')

      ffmpegArgs.push('-map', inputLabel, `-c:v:${currentIdx}`, encoder)

      // Align GOP for DASH (Keyframe every 4 seconds)
      ffmpegArgs.push(`-g:v:${currentIdx}`, `${GOP_SIZE}`, `-keyint_min:v:${currentIdx}`, `${GOP_SIZE}`)

      if (isNvenc) {
        ffmpegArgs.push(`-rc:v:${currentIdx}`, 'vbr', `-cq:v:${currentIdx}`, codec.name === 'avc' ? '23' : '28', `-preset:v:${currentIdx}`, 'p4')
        // av1_nvenc has no named profiles (passing "main" makes ffmpeg abort), so only set it for h264/hevc
        if (codec.name !== 'av1') ffmpegArgs.push(`-profile:v:${currentIdx}`, codec.name === 'hevc' ? 'main' : 'high')
      } else if (isQsv) {
        // Intel QSV specific bitrate control
        ffmpegArgs.push(`-global_quality:v:${currentIdx}`, '25', `-preset:v:${currentIdx}`, 'medium')
      } else {
        // Software Fallback
        ffmpegArgs.push(`-sc_threshold:v:${currentIdx}`, '0')
        if (codec.name === 'av1') {
          ffmpegArgs.push(`-crf:v:${currentIdx}`, '35', `-preset:v:${currentIdx}`, '8')
        } else {
          ffmpegArgs.push(`-b:v:${currentIdx}`, variant.videoBitrate, `-maxrate:v:${currentIdx}`, variant.videoBitrate, `-bufsize:v:${currentIdx}`, `${Number.parseInt(variant.videoBitrate) * 2}k`)
          if (codec.name === 'avc') ffmpegArgs.push(`-profile:v:${currentIdx}`, 'high', `-preset:v:${currentIdx}`, 'medium')
          if (codec.name === 'hevc') ffmpegArgs.push(`-tag:v:${currentIdx}`, 'hvc1', `-preset:v:${currentIdx}`, 'medium')
          if (codec.name === 'vp9') ffmpegArgs.push(`-deadline:v:${currentIdx}`, 'good', `-cpu-used:v:${currentIdx}`, '2')
        }
      }
      outputStreamIndex++
    }
  }

  // Audio streams
  for (const audioVar of AUDIO_VARIANTS) {
    const currentIdx = outputStreamIndex
    ffmpegArgs.push('-map', '0:a:0', `-c:a:${currentIdx}`, 'aac', `-b:a:${currentIdx}`, audioVar.bitrate, `-ac:a:${currentIdx}`, `${audioVar.channels}`, `-ar:a:${currentIdx}`, '48000')
    outputStreamIndex++
  }

  // Adaptation Sets
  const adaptationSets: string[] = []
  for (let i = 0; i < CODECS.length; i++) {
    const streams = VIDEO_VARIANTS.map((_, resIdx) => i + resIdx * CODECS.length)
    adaptationSets.push(`id=${i},streams=${streams.join(',')}`)
  }
  const audioIndices = AUDIO_VARIANTS.map((_, i) => VIDEO_VARIANTS.length * CODECS.length + i)
  adaptationSets.push(`id=${CODECS.length},streams=${audioIndices.join(',')}`)

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

  return { ffmpegArgs, mpdFileName, chosen }
}

export default async function (filePath: string, outputDir: string) {
  if (!filePath || typeof filePath !== 'string') throw new Error('Invalid filePath')

  const absoluteFilePath = path.resolve(filePath)
  const outputName = path.basename(filePath.split('_').at(-1)!, path.extname(filePath))

  // Hardware is tried first when available; a failed hardware run is retried once in software
  const hardware = await getFunctionalEncoders()
  const attempts = hardware.size > 0 ? [hardware, new Set<string>()] : [new Set<string>()]

  for (const [index, encoders] of attempts.entries()) {
    const { ffmpegArgs, mpdFileName, chosen } = buildArgs(absoluteFilePath, outputName, encoders)
    const usedHardware = Object.values(chosen).filter((encoder) => encoders.has(encoder))

    await logEncoders(
      Object.entries(chosen)
        .map(([codec, encoder]) => `${codec}:${encoder}`)
        .join(',')
    )

    try {
      // Test hook: simulate a hardware encoder failure to exercise the software fallback
      if (import.meta.env.MOTIA_MMEDIA_TEST_FAIL_HW === '1' && usedHardware.length > 0) {
        throw new Error('Simulated hardware encoder failure')
      }

      await execa('ffmpeg', ffmpegArgs, { cwd: outputDir })
      return { success: true, mpdFile: path.join(outputDir, mpdFileName) }
    } catch (error) {
      if (usedHardware.length === 0 || index === attempts.length - 1) {
        console.error('❌ FFmpeg fatal error:', error)
        throw error
      }

      logger.warn(`Hardware encode failed (${usedHardware.join(', ')}); retrying with software encoders`, { error: error instanceof Error ? error.message.slice(-500) : String(error) })
      markEncodersFailed(usedHardware)
    }
  }

  throw new Error('Video transcode failed')
}
