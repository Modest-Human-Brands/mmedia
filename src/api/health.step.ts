import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { describeEncoders } from 'src/utils/hw-encoders'

export const config = {
  name: 'HealthCheck',
  description: 'Return Health Status',
  flows: ['health-check-flow'],
  triggers: [
    http('GET', '/health', {
      responseSchema: {
        200: z.object({
          status: z.string(),
          version: z.string().optional(),
          buildTime: z.string().optional(),
          node: z.string(),
          encoders: z
            .object({
              mode: z.string(),
              nvenc: z.array(z.string()),
              qsv: z.array(z.string()),
              failed: z.array(z.string()),
            })
            .optional(),
        }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_) => {
  // com.docker.compose.service || com.docker.swarm.task.name
  const node = import.meta.env.HOSTNAME || 'unknown-node'
  const encoders = await describeEncoders().catch(() => undefined)

  return {
    status: 200,
    body: {
      status: 'OK',
      version: import.meta.env.MOTIA_MMEDIA_APP_VERSION,
      buildTime: import.meta.env.MOTIA_MMEDIA_APP_BUILD_TIME,
      node,
      encoders,
    },
  }
}
