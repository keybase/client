// Hot dev serves the renderer from the Vite dev server, and an http origin can't
// load file:// subresources. The main process registers this scheme and serves
// local files through it; see node.desktop.tsx. The dev CSP in vite.config.mts
// has to allow it too.
export const localFileScheme = 'kbfile'
const localFileHost = 'local'

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
      return encodeFilePathURL(decodeURI(path))
    }
    if (url.includes(' ') || url.includes('#')) {
      return encodeURI(url).replace(/#/g, '%23')
    }
  }
  return url
}

// path is an absolute posix-style path, leading slash included
const encodeFilePathURL = (path: string) => {
  if (__HOT__) {
    return `${localFileScheme}://${localFileHost}${path.split('/').map(encodeURIComponent).join('/')}`
  }
  return encodeURI(`file://${path}`).replace(/#/g, '%23')
}
