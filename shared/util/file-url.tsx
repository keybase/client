import {urlEscapeFilePath} from '@/styles/styles-base'

// Hot dev serves the renderer from the Vite dev server, and an http origin can't
// load file:// subresources. The main process registers this scheme and serves
// local files through it; see node.desktop.tsx. The dev CSP in vite.config.mts
// has to allow it too.
export const localFileScheme = 'kbfile'
export const localFileHost = 'local'

const filePrefix = 'file://'

// Desktop: normalize absolute file paths (posix or windows) to encoded file:// URLs
export const normalizeFilePathURL = (url: string) => {
  const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(url)
  if (url.startsWith('/') || isWindowsPath) {
    let path = url.replace(/\\/g, '/')
    if (isWindowsPath && !path.startsWith('/')) {
      path = '/' + path
    }
    return encodeFilePathURL(path)
  }
  if (url.startsWith(filePrefix)) {
    return encodeFilePathURL(decodeFilePath(url.slice(filePrefix.length)))
  }
  return url
}

// A file:// url reaches us either already encoded or as a raw path, so decode
// down to the real path before re-encoding. Per segment and with the raw segment
// as the fallback: decodeURI leaves reserved characters alone (an encoded '#'
// would survive as %23 and then double-encode), and either decoder throws on a
// filename holding a literal '%'.
const decodeFilePath = (path: string) =>
  path
    .split('/')
    .map(seg => {
      try {
        return decodeURIComponent(seg)
      } catch {
        return seg
      }
    })
    .join('/')

// A windows drive letter keeps its literal colon: chromium only recognizes
// `file:///C:/...` as a drive path, an escaped `%3A` reads as a filename.
const restoreDriveColon = (path: string) => path.replace(/^\/([a-zA-Z])%3A(?=\/|$)/, '/$1:')

// path is an absolute posix-style path, leading slash included.
// Shares one escaper with the native side (styles-base's urlEscapeFilePath) so
// both encoders agree with the media url allowlist in common-adapters/video.tsx,
// which rejects the !'()*~,;@+[]? that encodeURI/encodeURIComponent leave alone.
const encodeFilePathURL = (path: string) => {
  const encoded = restoreDriveColon(urlEscapeFilePath(`${filePrefix}${path}`).slice(filePrefix.length))
  return __HOT__ ? `${localFileScheme}://${localFileHost}${encoded}` : `${filePrefix}${encoded}`
}
