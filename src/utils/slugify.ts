export default function (value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^A-Za-z0-9_/]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
