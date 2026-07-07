// Desktop: normalize absolute file paths (posix or windows) to encoded file:// URLs
export const normalizeFilePathURL = (url: string) => {
  const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(url)
  if (url.startsWith('/') || isWindowsPath) {
    let path = url.replace(/\\/g, '/')
    if (isWindowsPath && !path.startsWith('/')) {
      path = '/' + path
    }
    return encodeURI(`file://${path}`).replace(/#/g, '%23')
  }
  if (url.startsWith('file://') && (url.includes(' ') || url.includes('#'))) {
    return encodeURI(url).replace(/#/g, '%23')
  }
  return url
}
