import { http, type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'

export const config = {
  name: 'HealthCheck',
  description: 'Return Health Status',
  flows: ['health-check-flow'],
  triggers: [
    http('GET', '/health', {
      responseSchema: {
        200: z.object({
          status: z.string(),
        }),
      },
    }),
  ],
  enqueues: [],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (_) => {
  // com.docker.compose.service || com.docker.swarm.task.name
  const node = import.meta.env.HOSTNAME || 'unknown-node'

  return {
    status: 200,
    body: {
      status: 'OK',
      version: import.meta.env.MOTIA_APP_VERSION,
      buildTime: import.meta.env.MOTIA_APP_BUILD_TIME,
      node,
    },
  }
}
