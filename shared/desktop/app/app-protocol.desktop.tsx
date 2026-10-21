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

// A drive-absolute path (C:\...) naming a file, not a share, device or stream
const isWindowsDrivePath = (p: string) =>
  /^[a-zA-Z]:\\/.test(p) &&
  !p.slice(2).includes(':') &&
  !p.split('\\').some(seg => windowsDeviceName.test(seg.replace(/[. ]+$/, '')))

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
