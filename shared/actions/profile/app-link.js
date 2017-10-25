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
  // Adapted username regexp (see checkers.go) with a leading / and an
  // optional trailing /.
  const match = pathname.match(/^\/((?:[a-zA-Z0-9][a-zA-Z0-9_]?)+)\/?$/)
  if (!match) {
    return null
  }

  const usernameMatch = match[1]
  if (usernameMatch.length < 2 || usernameMatch.length > 16) {
    return null
  }

  // Ignore query string and hash parameters.

  const username = usernameMatch.toLowerCase()
  return username
}

export {urlToUsername}
