import { logger, type ApiMiddleware } from 'motia'
import { timingSafeEqual } from 'node:crypto'

const requireApiKey: ApiMiddleware = async ({ request }, _ctx, next) => {
  const expected = import.meta.env.MOTIA_API_KEY
  if (!expected) {
    logger.error('MOTIA_API_KEY is not configured; rejecting request')
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  const header = Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'x-api-key')?.[1]
  const provided = Array.isArray(header) ? header[0] : header

  const a = Buffer.from(provided ?? '')
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  return next()
}

export default requireApiKey
