import path from 'path'
import {localFileHost, localFileScheme} from '@/util/file-url'

// Packaged builds and cold dev serve the app's own pages and assets from this
// origin (hot dev uses the Vite dev server instead). It has to differ from the
// `keybase:` deep-link scheme.
export const appScheme = 'kbapp'
export const appHost = 'app'
export const appOrigin = `${appScheme}://${appHost}`

type PathModule = Pick<typeof path, 'isAbsolute' | 'relative' | 'resolve' | 'sep'>

const decodePathname = (url: string, scheme: string, host: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${scheme}:` || parsed.host !== host) return undefined
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

// The local path a local-file-scheme request names. Windows paths are carried
// with a leading slash (/C:/...) so the URL stays absolute.
export const localFilePathFromURL = (url: string) => {
  const pathname = decodePathname(url, localFileScheme, localFileHost)
  return pathname?.replace(/^\/([a-zA-Z]:)/, '$1')
}
