import { createIPX, ipxFSStorage } from 'ipx'

const ipx = createIPX({
  storage: ipxFSStorage({ dir: './' }),
})

export default async function (filePath: string, modifiers: Record<string, string | number | boolean>) {
  const processor = ipx(filePath, modifiers)

  const { data } = await processor.process()

  return data
}
