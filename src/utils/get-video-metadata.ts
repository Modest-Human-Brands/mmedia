import { execa } from 'execa'

export interface VideoFormat {
  filename: string
  formatName: string
  duration: number // In seconds
  size: number // In bytes
  bitRate: number // In bits per second
}

export interface VideoStream {
  codecName: string
  codecType: string
  width?: number
  height?: number
  bitRate?: number // In bits per second
  duration?: number // In seconds
  frameRate?: number // Frames per second
}

export interface VideoMetadata {
  format: VideoFormat
  stream: VideoStream // Only the main video stream
}

export default async function (filePath: string): Promise<VideoMetadata> {
  const { stdout } = await execa('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath])
  const data = JSON.parse(stdout)

  const videoStream = data.streams.find((s: { codec_type: string }) => s.codec_type === 'video')
  return {
    format: {
      filename: data.format.filename,
      formatName: data.format.format_name,
      duration: Number(data.format.duration),
      size: Number(data.format.size),
      bitRate: Number(data.format.bit_rate),
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
