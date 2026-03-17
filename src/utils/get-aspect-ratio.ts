const aspectRatio = ['16:9', '3:2', '4:3', '1:1', '3:4', '2:3', '9:16'] as const
export type AspectRatio = (typeof aspectRatio)[number]

/**
 * Determine the nearest aspect-ratio bucket based on width/height.
 */
export default function (width: number, height: number): AspectRatio {
  let best: AspectRatio = aspectRatio[0]
  for (const ar of aspectRatio) {
    const [bw, bh] = best.split(':').map(Number)
    const [cw, ch] = ar.split(':').map(Number)
    const diffBest = Math.abs(width / height - bw / bh)
    const diffCurr = Math.abs(width / height - cw / ch)
    if (diffCurr < diffBest) best = ar
  }
  return best
}
