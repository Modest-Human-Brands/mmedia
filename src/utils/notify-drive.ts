import { $fetch } from 'ofetch'

interface DriveStatus {
  filename: string
  projectId: string
  status: 'processing' | 'completed' | 'failed'
  progressPercent: number
  error: string | null
  data: unknown
}

export default async function (payload: DriveStatus) {
  const apiKey = import.meta.env.MOTIA_MMEDIA_DRIVE_API_KEY
  if (!apiKey) throw new Error('MOTIA_MMEDIA_DRIVE_API_KEY is not configured')

  await $fetch('/webhook/uploads/status', {
    baseURL: import.meta.env.MOTIA_MMEDIA_DRIVE_URL,
    method: 'PUT',
    headers: { 'x-api-key': apiKey },
    body: { ...payload, mediaId: null },
    timeout: 10_000,
    retry: 2,
    retryDelay: 500,
  })
}
