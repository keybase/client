const localhostPrefix = /^http:\/\/127\.0\.0\.1:\d+/

export const isLocalhostSrc = (src: unknown): src is string =>
  typeof src === 'string' && localhostPrefix.test(src)

// The service can restart its http server on a new port, but chat bakes the address into
// attachment and emoji URLs, so a retry points the src at wherever the server is now. The
// cache-buster forces expo-image to actually refetch.
export const retryLocalhostSrc = (src: string, attempt: number, httpSrv: {address: string}) => {
  const next = httpSrv.address ? src.replace(localhostPrefix, `http://${httpSrv.address}`) : src
  return `${next}${next.includes('?') ? '&' : '?'}kbRetry=${attempt}`
}
