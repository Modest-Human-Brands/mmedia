export default function (slug: string, deviceId: string): string {
  return `${import.meta.env.MOTIA_CDN_HOST}/live/${slug}/${deviceId}/hls/master.m3u8`
}
