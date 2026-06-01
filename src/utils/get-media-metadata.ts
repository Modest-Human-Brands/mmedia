import { execa } from 'execa'
import { imageMeta } from 'image-meta'
import exifr from 'exifr'
import { readFile, stat } from 'node:fs/promises'

export type MediaKind = 'photo' | 'audio' | 'video'

export interface MediaFormat {
  filename: string
  formatName: string
  size: number
  width?: number
  height?: number
  duration?: number
  bitRate?: number
  bitDepth?: string | number
  resolution?: string
  aspectRatio?: string
  camera?: string
  lens?: string
  location?: { lat: number; lng: number }
}

export interface MediaStream {
  codecName: string
  codecType: string
  resolution?: string
  aspectRatio?: string
  bitRate?: number
  duration?: number
  frameRate?: number
  sampleRate?: number
  channels?: number
}

export interface MediaMetadata {
  kind: MediaKind
  format: MediaFormat
  stream?: MediaStream
}

/**
 * Helper: Calculates human-readable aspect ratio (e.g., "16:9")
 */
function getAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(width, height)
  return `${width / divisor}:${height / divisor}`
}

function getMediaKind(filePath: string): MediaKind {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'cr2', 'tiff', 'gif', 'heic'].includes(ext)) return 'photo'
  if (['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'].includes(ext)) return 'audio'
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  throw new Error(`Unsupported media extension: .${ext}`)
}

export default async function getMediaMetadata(filePath: string): Promise<MediaMetadata> {
  const kind = getMediaKind(filePath)

  // 1. Process Images
  if (kind === 'photo') {
    const [data, fileStat] = await Promise.all([readFile(filePath), stat(filePath)])
    const meta = imageMeta(data)

    // Extract deep EXIF data gracefully
    const exif = await exifr.parse(data, { tiff: true, xmp: true, gps: true }).catch(() => ({}))

    if (typeof meta.width !== 'number' || typeof meta.height !== 'number') {
      throw new TypeError(`Could not determine image dimensions for: ${filePath}`)
    }

    const cameraMake = exif?.Make
    const cameraModel = exif?.Model
    const camera = cameraMake && cameraModel ? `${cameraMake} ${cameraModel}` : cameraModel || cameraMake

    return {
      kind: 'photo',
      format: {
        filename: filePath,
        formatName: meta.type ?? '',
        size: fileStat.size,
        resolution: `${meta.width}p`,
        aspectRatio: getAspectRatio(meta.width, meta.height),
        bitDepth: exif?.BitsPerSample ? `${exif.BitsPerSample} bit` : undefined,
        camera: camera?.trim(),
        lens: exif?.LensModel || exif?.Lens,
        location: exif?.latitude && exif?.longitude ? { lat: exif.latitude, lng: exif.longitude } : undefined,
      },
    }
  }

  // 2. Process Audio & Video via ffprobe
  const { stdout } = await execa('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath])
  const data = JSON.parse(stdout)

  if (kind === 'video') {
    const videoStream = data.streams.find((s: { codec_type: string }) => s.codec_type === 'video')
    if (!videoStream) throw new Error(`No video stream found in file: ${filePath}`)

    const width = videoStream.width
    const height = videoStream.height

    // Attempt to extract tags (usually injected by smartphones/cameras)
    const tags = data.format.tags || videoStream.tags || {}
    const locationMatch = tags['com.apple.quicktime.location.ISO6709']?.match(/([+-]\d+\.\d+)([+-]\d+\.\d+)/)

    return {
      kind: 'video',
      format: {
        filename: data.format.filename,
        formatName: data.format.format_name,
        duration: Number(data.format.duration),
        size: Number(data.format.size),
        bitRate: Number(data.format.bit_rate),
        resolution: `${width}p`,
        aspectRatio: width && height ? getAspectRatio(width, height) : undefined,
        bitDepth: videoStream.bits_per_raw_sample ? `${videoStream.bits_per_raw_sample} bit` : videoStream.pix_fmt,
        camera: tags['model'] || tags['make'],
        location: locationMatch ? { lat: Number(locationMatch[1]), lng: Number(locationMatch[2]) } : undefined,
      },
      stream: {
        codecName: videoStream.codec_name,
        codecType: videoStream.codec_type,
        resolution: `${width}p`,
        aspectRatio: width && height ? getAspectRatio(width, height) : undefined,
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

  // Handle Audio Pipeline (unchanged logic, just structured)
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
