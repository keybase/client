// @flow
import {apiserverGetRpc} from '../constants/types/flow-types'
import throttle from 'lodash/throttle'
import partition from 'lodash/partition'

type URLMap = {[key: string]: string}
type Info = {
  urlMap: ?URLMap,
  callbacks: Array<(username: string, urlMap: ?URLMap) => void>,
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

  const [good, bad] = partition(usersToResolve, u => validUsername(u))

  bad.forEach(username => {
    const info = _usernameToURL[username]
    const urlMap = {}
    if (info) {
      info.done = true
      info.error = true
      info.callbacks.forEach(cb => cb(username, urlMap))
      info.callbacks = []
    }
  })

  if (!good.length) {
    return
  }

  apiserverGetRpc({
    callback: (error, response) => {
      if (error) {
        good.forEach(username => {
          const info = _usernameToURL[username]
          const urlMap = {}
          if (info) {
            info.done = true
            info.error = true
            info.callbacks.forEach(cb => cb(username, urlMap))
            info.callbacks = []
          }
        })
      } else {
        JSON.parse(response.body).pictures.forEach((picMap, idx) => {
          const username = good[idx]
          let urlMap = {
            ...(picMap['square_200'] ? {'200': picMap['square_200']} : null),
            ...(picMap['square_360'] ? {'360': picMap['square_360']} : null),
            ...(picMap['square_40'] ? {'40': picMap['square_40']} : null),
          }

          const info = _usernameToURL[username]
          if (info) {
            info.done = true
            info.urlMap = urlMap
            info.callbacks.forEach(cb => cb(username, urlMap))
            info.callbacks = []
          }
        })
      }
    },
    param: {
      args: [
        {key: 'usernames', value: good.join(',')},
        {key: 'formats', value: 'square_360,square_200,square_40'},
      ],
      endpoint: 'image/username_pic_lookups',
    },
  })
}, 200)

function validUsername(name: ?string) {
  if (!name) {
    return false
  }

  return !!name.match(/^([a-z0-9][a-z0-9_]{1,15})$/i)
}

function getUserImageMap(username: string): ?URLMap {
  const info = _usernameToURL[username]
  return info ? info.urlMap : null
}

function loadUserImageMap(username: string, callback: (username: string, urlMap: ?URLMap) => void) {
  const info = _usernameToURL[username] || _pendingUsernameToURL[username]
  if (info) {
    if (!info.done) {
      info.callbacks.push(callback)
    } else {
      setImmediate(() => {
        callback(username, info.urlMap)
      })
    }
  } else {
    _pendingUsernameToURL[username] = {
      callbacks: [callback],
      done: false,
      error: false,
      requested: false,
      urlMap: null,
    }
    _getUserImages()
  }
}

function clearErrors() {
  Object.keys(_usernameToURL).forEach(k => {
    if (_usernameToURL[k] && _usernameToURL[k].error) {
      delete _usernameToURL[k]
    }
  })
}

export {getUserImageMap, loadUserImageMap, clearErrors}
