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

  // TODO: More restrictive username parser.
  const match = pathname.match(/^\/(\w+)\/?$/i)
  if (!match) {
    return null
  }

  const username = match[1].toLocaleLowerCase()
  return username
}

export {urlToUsername}
