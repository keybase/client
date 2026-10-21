import crypto from 'crypto'
import path from 'path'
import {localFileScheme} from '@/util/file-url'

// Packaged builds and cold dev serve the app's own pages and assets from this
// origin (hot dev uses the Vite dev server instead). It has to differ from the
// `keybase:` deep-link scheme.
export const appScheme = 'kbapp'
export const appHost = 'app'
export const appOrigin = `${appScheme}://${appHost}`

type PathModule = Pick<typeof path, 'isAbsolute' | 'relative' | 'resolve' | 'sep'>

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

const decodePathname = (url: string, scheme: string, host: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${scheme}:` || !sameSecret(parsed.host, host)) return undefined
    const decoded = decodeURIComponent(parsed.pathname)
    return decoded.includes('\0') ? undefined : decoded
  } catch {
    return undefined
  }
}

// The file an app-scheme request maps to. Only files strictly inside root are
// served; any other request maps to nothing.
export const resolveAppFilePath = (root: string, url: string, p: PathModule = path) => {
  const pathname = decodePathname(url, appScheme, appHost)
  if (pathname === undefined) return undefined
  const base = p.resolve(root)
  const resolved = p.resolve(base, pathname.replace(/^[/\\]+/, ''))
  const rel = p.relative(base, resolved)
  if (!rel || rel === '..' || rel.startsWith(`..${p.sep}`) || p.isAbsolute(rel)) return undefined
  return resolved
}

// Windows device names, which name a device rather than a file in any folder
const windowsDeviceName = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3])(\..*)?$/i

// Windows ignores trailing dots and spaces, both on a whole name and before its extension
const trimWindowsName = (seg: string) => seg.replace(/[. ]+$/, '')
const isWindowsDeviceSegment = (seg: string) =>
  windowsDeviceName.test(trimWindowsName(seg)) || windowsDeviceName.test(trimWindowsName(seg.split('.')[0] ?? ''))

// A drive-absolute path (C:\...) naming a file, not a share, device or stream
const isWindowsDrivePath = (p: string) =>
  /^[a-zA-Z]:\\/.test(p) &&
  !p.slice(2).includes(':') &&
  !p.split('\\').some(isWindowsDeviceSegment)

// The local path a local-file-scheme request names, for a URL carrying this
// launch's host. Windows paths are carried with a leading slash (/C:/...) so the
// URL stays absolute, and only drive-absolute paths are served there.
export const localFilePathFromURL = (url: string, host: string, platform: string) => {
  const pathname = decodePathname(url, localFileScheme, host)
  if (pathname === undefined) return undefined
  if (platform !== 'win32') return pathname
  const p = path.win32.normalize(pathname.replace(/^\/(?=[a-zA-Z]:)/, ''))
  return isWindowsDrivePath(p) ? p : undefined
}

// The byte range a Range header asks for in a file of `size` bytes, so media
// elements can seek. A missing, malformed or multi-range header means the whole
// file; 'unsatisfiable' means the range starts past the end.
export const parseByteRange = (header: string | null, size: number) => {
  const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null
  if (!m) return undefined
  const [, first = '', last = ''] = m
  if (!first && !last) return undefined
  let start: number
  let end: number
  if (first) {
    start = Number(first)
    end = last ? Math.min(Number(last), size - 1) : size - 1
    if (last && Number(last) < start) return undefined
  } else {
    start = Math.max(size - Number(last), 0)
    end = size - 1
  }
  if (start >= size || size === 0) return 'unsatisfiable'
  return {end, start}
}

// The range to serve for a request whose file was last modified at `lastModified` (an HTTP date).
// An If-Range that is not that date means the caller's copy is stale, so it gets the whole file.
export const requestedRange = (
  rangeHeader: string | null,
  ifRangeHeader: string | null,
  lastModified: string,
  size: number
) => {
  if (ifRangeHeader !== null && ifRangeHeader.trim() !== lastModified) return undefined
  return parseByteRange(rangeHeader, size)
}

// Content types for the media the renderer loads through the local file scheme
const mimeTypes: {[ext: string]: string} = {
  aac: 'audio/aac',
  avif: 'image/avif',
  bmp: 'image/bmp',
  flac: 'audio/flac',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  m4a: 'audio/mp4',
  m4v: 'video/x-m4v',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  png: 'image/png',
  svg: 'image/svg+xml',
  wav: 'audio/wav',
  webm: 'video/webm',
  webp: 'image/webp',
}

export const mimeTypeForPath = (filePath: string) => {
  const ext = /\.([^./\\]+)$/.exec(filePath)?.[1]?.toLowerCase()
  return ext && Object.hasOwn(mimeTypes, ext) ? mimeTypes[ext] : undefined
}

// Flags for opening a local file to serve. Non-blocking on posix so opening a
// path that turns out not to be a regular file returns at once.
export const localFileOpenFlags = (
  platform: string,
  constants: {O_NONBLOCK?: number; O_RDONLY: number}
): number | string =>
  platform === 'win32' ? 'r' : constants.O_RDONLY | (constants.O_NONBLOCK ?? 0)

// Whether two stats describe the same file
export const isSameFile = (a: {dev: number; ino: number}, b: {dev: number; ino: number}) =>
  a.dev === b.dev && a.ino === b.ino
