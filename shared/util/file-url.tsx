// Hot dev serves the renderer from the Vite dev server, and an http origin can't
// load file:// subresources. The main process registers this scheme and serves
// local files through it; see node.desktop.tsx. The dev CSP in vite.config.mts
// has to allow it too.
export const localFileScheme = 'kbfile'
export const localFileHost = 'local'

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
  if (url.startsWith('file://')) {
    const path = url.slice('file://'.length)
    if (__HOT__) {
      return encodeFilePathURL(decodeFilePath(path))
    }
    if (url.includes(' ') || url.includes('#')) {
      return encodeURI(url).replace(/#/g, '%23')
    }
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

// path is an absolute posix-style path, leading slash included
const encodeFilePathURL = (path: string) => {
  if (__HOT__) {
    return `${localFileScheme}://${localFileHost}${path.split('/').map(encodeURIComponent).join('/')}`
  }
  return encodeURI(`file://${path}`).replace(/#/g, '%23')
}
