const localhostPrefix = /^http:\/\/127\.0\.0\.1:\d+/

// The service's own endpoints: "at" (go/chat/attachment_httpsrv.go), "av" (go/avatars/srv.go) and
// "map" (go/chat/maps/srv.go). KBFS serves /files/ from a second local server with its own port and
// its own token, so a src has to be matched against these before anything is repointed.
const serviceSrc = /^http:\/\/127\.0\.0\.1:\d+\/(?:at|av|map)(?=[?#]|$)/

export const isLocalhostSrc = (src: unknown): src is string =>
  typeof src === 'string' && localhostPrefix.test(src)

// The service can restart its http server on a new port, but chat bakes the address into
// attachment and emoji URLs, so a retry points the src at wherever the server is now. A service
// process restart draws a fresh port and mints a new per-process token (see
// go/kbhttp/manager/manager.go), and a reconnect alone doesn't refetch already-rendered thread
// data, so the token also needs rewriting or a stale token= keeps failing forever. The
// cache-buster forces expo-image to actually refetch, and is all a non-service src gets.
export const retryLocalhostSrc = (
  src: string,
  attempt: number,
  httpSrv: {address: string; token: string}
) => {
  let next = src
  if (serviceSrc.test(src)) {
    if (httpSrv.address) {
      next = next.replace(localhostPrefix, `http://${httpSrv.address}`)
    }
    if (httpSrv.token) {
      next = next.replace(/([?&]token=)[^&#]*/, `$1${httpSrv.token}`)
    }
  }
  return `${next}${next.includes('?') ? '&' : '?'}kbRetry=${attempt}`
}
