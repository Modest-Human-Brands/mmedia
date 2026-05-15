import { execa } from 'execa'
import { imageMeta } from 'image-meta'
import { readFile, stat } from 'node:fs/promises'

export type MediaKind = 'photo' | 'audio' | 'video'

export interface MediaFormat {
  filename: string
  formatName: string
  size: number
  width?: number // Available for photo, video
  height?: number // Available for photo, video
  duration?: number // Available for audio, video (seconds)
  bitRate?: number // Available for audio, video (bits per second)
}

export interface MediaStream {
  codecName: string
  codecType: string
  width?: number // video only
  height?: number // video only
  bitRate?: number // audio, video
  duration?: number // audio, video
  frameRate?: number // video only
  sampleRate?: number // audio only (Hz)
  channels?: number // audio only (mono/stereo/etc)
}

export interface MediaMetadata {
  kind: MediaKind
  format: MediaFormat
  stream?: MediaStream // Optional because images do not have codec streams
}

/**
 * Determines the file type category based on the file extension
 */
function getMediaKind(filePath: string): MediaKind {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'cr2', 'tiff', 'gif'].includes(ext)) return 'photo'
  if (['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'].includes(ext)) return 'audio'
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  throw new Error(`Unsupported media extension: .${ext}`)
}

/**
 * Unified metadata extraction utility for Photos, Videos, and Audio files
 */
export default async function getMediaMetadata(filePath: string): Promise<MediaMetadata> {
  const kind = getMediaKind(filePath)

  // 1. Process Images
  if (kind === 'photo') {
    const [data, fileStat] = await Promise.all([readFile(filePath), stat(filePath)])
    const meta = imageMeta(data)

    if (typeof meta.width !== 'number' || typeof meta.height !== 'number') {
      throw new TypeError(`Could not determine image dimensions for: ${filePath}`)
    }

    return {
      kind: 'photo',
      format: {
        filename: filePath,
        formatName: meta.type ?? '',
        size: fileStat.size,
        width: meta.width,
        height: meta.height,
      },
    }
  }

  // 2. Process Audio & Video via ffprobe
  const { stdout } = await execa('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath])
  const data = JSON.parse(stdout)

  // Handle Video Pipeline
  if (kind === 'video') {
    const videoStream = data.streams.find((s: { codec_type: string }) => s.codec_type === 'video')
    if (!videoStream) throw new Error(`No video stream found in file: ${filePath}`)

    return {
      kind: 'video',
      format: {
        filename: data.format.filename,
        formatName: data.format.format_name,
        duration: Number(data.format.duration),
        size: Number(data.format.size),
        bitRate: Number(data.format.bit_rate),
        width: videoStream.width,
        height: videoStream.height,
      },
      stream: {
        codecName: videoStream.codec_name,
        codecType: videoStream.codec_type,
        width: videoStream.width,
        height: videoStream.height,
        bitRate: videoStream.bit_rate ? Number(videoStream.bit_rate) : undefined,
        duration: videoStream.duration ? Number(videoStream.duration) : undefined,
        frameRate: videoStream.avg_frame_rate
          ? (() => {
              const [n, d] = videoStream.avg_frame_rate.split('/')
              return d ? Number(n) / Number(d) : Number(n)
            })()
          : undefined,
      },
    }
  }

  // Handle Audio Pipeline
  const audioStream = data.streams.find((s: { codec_type: string }) => s.codec_type === 'audio')
  if (!audioStream) throw new Error(`No audio stream found in file: ${filePath}`)

  return {
    kind: 'audio',
    format: {
      filename: data.format.filename,
      formatName: data.format.format_name,
      duration: Number(data.format.duration),
      size: Number(data.format.size),
      bitRate: Number(data.format.bit_rate),
    },
    stream: {
      codecName: audioStream.codec_name,
      codecType: audioStream.codec_type,
      bitRate: audioStream.bit_rate ? Number(audioStream.bit_rate) : undefined,
      duration: audioStream.duration ? Number(audioStream.duration) : undefined,
      sampleRate: audioStream.sample_rate ? Number(audioStream.sample_rate) : undefined,
      channels: audioStream.channels ? Number(audioStream.channels) : undefined,
    },
  }
}
