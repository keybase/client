// URLs of the service's local http servers on 127.0.0.1, shared by the main process and the
// renderer. Chat attachments are served at /at (go/chat/attachment_httpsrv.go) and KBFS files under
// /files/ (go/kbfs/libhttpserver). No node or electron imports.
export const parseURL = (url: unknown) => {
  if (typeof url !== 'string') return undefined
  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

export const localServerURL = (url: unknown) => {
  const u = parseURL(url)
  return u?.protocol === 'http:' && u.hostname === '127.0.0.1' ? u : undefined
}
export const isKbfsPath = (pathname: string) => pathname.startsWith('/files/')
const isPreviewPath = (pathname: string) => pathname === '/at' || isKbfsPath(pathname)

// A chat attachment or KBFS file preview, which PDF previews load in an <embed>. The service's
// ports are not fixed, so any 127.0.0.1 port is accepted.
export const isPreviewURL = (url: unknown) => {
  const local = localServerURL(url)
  return !!local && isPreviewPath(local.pathname)
}
