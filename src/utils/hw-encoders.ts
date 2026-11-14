import { execa } from 'execa'
import { logger } from 'motia'

export type HwMode = 'auto' | 'off' | 'nvenc' | 'qsv'

const CANDIDATES = ['h264_nvenc', 'hevc_nvenc', 'av1_nvenc', 'h264_qsv', 'hevc_qsv', 'av1_qsv', 'vp9_qsv']

// Encoders that failed at runtime (session limit, out of memory, ...). Kept for the process lifetime.
const failed = new Set<string>()

let probe: Promise<Set<string>> | undefined

export function getHwMode(): HwMode {
  const mode = (import.meta.env.MOTIA_MMEDIA_HW_ACCEL || 'auto').toLowerCase()
  return mode === 'off' || mode === 'nvenc' || mode === 'qsv' ? mode : 'auto'
}

/**
 * Capability check to ensure hardware can actually OPEN the encoder,
 * not just that the binary has it compiled.
 */
async function checkHardwareSupport(encoder: string): Promise<boolean> {
  try {
    // A 1-frame null encode shows whether the hardware session initializes
    await execa('ffmpeg', ['-f', 'lavfi', '-i', 'color=c=black:s=256x256', '-frames:v', '1', '-c:v', encoder, '-f', 'null', '-'])
    return true
  } catch {
    return false
  }
}

function isAllowed(encoder: string, mode: HwMode): boolean {
  if (mode === 'off') return false
  if (mode === 'nvenc') return encoder.endsWith('_nvenc')
  if (mode === 'qsv') return encoder.endsWith('_qsv')
  return true
}

/** Probes once per process; hardware that failed at runtime is excluded. */
export async function getFunctionalEncoders(): Promise<Set<string>> {
  const mode = getHwMode()
  probe ??= (async () => {
    const candidates = CANDIDATES.filter((encoder) => isAllowed(encoder, mode))
    const results = await Promise.all(candidates.map(async (encoder) => [encoder, await checkHardwareSupport(encoder)] as const))
    return new Set(results.filter(([, ok]) => ok).map(([encoder]) => encoder))
  })()

  const detected = await probe
  return new Set([...detected].filter((encoder) => !failed.has(encoder)))
}

/** Marks encoders as unusable for the rest of the process so the next job goes straight to software. */
export function markEncodersFailed(encoders: Iterable<string>) {
  for (const encoder of encoders) failed.add(encoder)
}

export async function describeEncoders() {
  const detected = await getFunctionalEncoders()
  const byFamily = (suffix: string) => [...detected].filter((encoder) => encoder.endsWith(suffix)).map((encoder) => encoder.split('_')[0])
  return {
    mode: getHwMode(),
    nvenc: byFamily('_nvenc'),
    qsv: byFamily('_qsv'),
    failed: [...failed],
  }
}

export async function logEncoders(chosen?: string) {
  try {
    const { mode, nvenc, qsv, failed: failedEncoders } = await describeEncoders()
    logger.info(`encoders: mode=${mode} nvenc=[${nvenc.join(',')}] qsv=[${qsv.join(',')}] failed=[${failedEncoders.join(',')}]${chosen ? ` chosen=${chosen}` : ''}`)
  } catch (error) {
    logger.warn('Could not detect hardware encoders', { error: error instanceof Error ? error.message : String(error) })
  }
}
