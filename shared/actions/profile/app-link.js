// @flow

function urlToUsername(url: URL): ?string {
  const protocol = url.protocol
  if (protocol !== 'http:' && protocol !== 'https:') {
    return null
  }

  if (url.username || url.password) {
    return null
  }

  const hostname = url.hostname
  if (hostname !== 'keybase.io' && hostname !== 'www.keybase.io') {
    return null
  }

  const port = url.port
  if (port) {
    if (protocol === 'http:' && port !== '80') {
      return null
    }

    if (protocol === 'https:' && port !== '443') {
      return null
    }
  }

  const pathname = url.pathname
  const match = pathname.match(/^\/([A-Za-z0-9_]+)\/?$/)
  if (!match) {
    return null
  }

  const username = match[1].toLowerCase()
  return username
}

export {urlToUsername}
