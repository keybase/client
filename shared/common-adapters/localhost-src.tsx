const localhostPrefix = /^http:\/\/127\.0\.0\.1:\d+/

export const isLocalhostSrc = (src: unknown): src is string =>
  typeof src === 'string' && localhostPrefix.test(src)

// The service can restart its http server on a new port, but chat bakes the address into
// attachment and emoji URLs, so a retry points the src at wherever the server is now. A bare
// service-process restart keeps the port but mints a new per-process token (see
// go/kbhttp/manager/manager.go), and a reconnect alone doesn't refetch already-rendered thread
// data, so the token also needs rewriting or a stale token= keeps failing forever. The
// cache-buster forces expo-image to actually refetch.
export const retryLocalhostSrc = (
  src: string,
  attempt: number,
  httpSrv: {address: string; token: string}
) => {
  let next = httpSrv.address ? src.replace(localhostPrefix, `http://${httpSrv.address}`) : src
  if (httpSrv.token) {
    next = next.replace(/([?&]token=)[^&#]*/, `$1${httpSrv.token}`)
  }
  return `${next}${next.includes('?') ? '&' : '?'}kbRetry=${attempt}`
}
