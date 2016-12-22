// @flow
import {apiserverGetRpc} from '../constants/types/flow-types'
import {throttle} from 'lodash'

type Info = {
  url: ?string,
  callbacks: Array<(username: string, url: ?string) => void>,
  done: boolean,
  error: boolean,
}

// Done
const _usernameToURL: {[key: string]: ?Info} = {}
// Not done
const _pendingUsernameToURL: {[key: string]: ?Info} = {}

const _getUserImages = throttle(() => {
  const usersToResolve = Object.keys(_pendingUsernameToURL)
  if (!usersToResolve.length) {
    return
  }

  // Move pending to non-pending state
  usersToResolve.forEach(username => {
    const info: ?Info = _pendingUsernameToURL[username]
    _usernameToURL[username] = info
    delete _pendingUsernameToURL[username]
  })

  apiserverGetRpc({
    param: {
      endpoint: 'image/username_pic_lookups',
      args: [
        {key: 'usernames', value: usersToResolve.join(',')},
        {key: 'formats', value: 'square_200'},
      ],
    },
    callback: (error, response) => {
      if (error) {
        usersToResolve.forEach(username => {
          const info = _usernameToURL[username]
          const url = null
          if (info) {
            info.done = true
            info.error = true
            info.callbacks.forEach(cb => cb(username, url))
          }
        })
      } else {
        JSON.parse(response.body).pictures.forEach((picMap, idx) => {
          const username = usersToResolve[idx]
          const url = picMap['square_200']
          const info = _usernameToURL[username]
          if (info) {
            info.done = true
            info.url = url
            info.callbacks.forEach(cb => cb(username, url))
          }
        })
      }
    },
  })
}, 200)

function validUsername (name: ?string) {
  if (!name) {
    return false
  }

  return !!name.match(/^([a-z0-9][a-z0-9_]{1,15})$/i)
}

export function getUserImage (username: string): ?string {
  if (!validUsername(username)) {
    return null
  }

  const info = _usernameToURL[username]
  return info ? info.url : null
}

export function loadUserImage (username: string, callback: (username: string, url: ?string) => void) {
  if (!validUsername(username)) {
    return
  }

  const info = _usernameToURL[username] || _pendingUsernameToURL[username]
  if (info) {
    if (!info.done) {
      info.callbacks.push(callback)
    }
  } else {
    _pendingUsernameToURL[username] = {
      url: null,
      callbacks: [callback],
      requested: false,
      done: false,
      error: false,
    }
    _getUserImages()
  }
}
