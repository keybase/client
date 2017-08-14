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
const _nameToURL: {[key: string]: ?Info} = {}
// Not done
const _pendingNameToURL: {[key: string]: ?Info} = {}

const _getUserImages = throttle(() => {
  const usersToResolve = Object.keys(_pendingNameToURL)
  if (!usersToResolve.length) {
    return
  }

  // Move pending to non-pending state
  usersToResolve.forEach(username => {
    const info: ?Info = _pendingNameToURL[username]
    _nameToURL[username] = info
    delete _pendingNameToURL[username]
  })

  const [good, bad] = partition(usersToResolve, u => validUsername(u))

  bad.forEach(username => {
    const info = _nameToURL[username]
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

  const [teamnames, usernames] = partition(good, g => _nameToURL[g].isTeam)

  if (usernames.length) {
    apiserverGetRpc({
      callback: (error, response) => {
        if (error) {
          usernames.forEach(username => {
            const info = _nameToURL[username]
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
            const username = usernames[idx]
            let urlMap = {
              ...(picMap['square_200'] ? {'200': picMap['square_200']} : null),
              ...(picMap['square_360'] ? {'360': picMap['square_360']} : null),
              ...(picMap['square_40'] ? {'40': picMap['square_40']} : null),
            }

            const info = _nameToURL[username]
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
  }

  if (teamnames.length) {
    apiserverGetRpc({
      callback: (error, response) => {
        if (error) {
          teamnames.forEach(teamname => {
            const info = _nameToURL[teamname]
            const urlMap = {}
            if (info) {
              info.done = true
              info.error = true
              info.callbacks.forEach(cb => cb(teamname, urlMap))
              info.callbacks = []
            }
          })
        } else {
          JSON.parse(response.body).pictures.forEach((picMap, idx) => {
            const teamname = teamnames[idx]
            let urlMap = {
              ...(picMap['square_200'] ? {'200': picMap['square_200']} : null),
              ...(picMap['square_360'] ? {'360': picMap['square_360']} : null),
              ...(picMap['square_40'] ? {'40': picMap['square_40']} : null),
            }

            const info = _nameToURL[teamname]
            if (info) {
              info.done = true
              info.urlMap = urlMap
              info.callbacks.forEach(cb => cb(teamname, urlMap))
              info.callbacks = []
            }
          })
        }
      },
      param: {
        args: [
          {key: 'team_names', value: good.join(',')},
          {key: 'formats', value: 'square_360,square_200,square_40'},
        ],
        endpoint: 'image/team_avatar_lookups',
      },
    })
  }
}, 200)

function validUsername(name: ?string) {
  if (!name) {
    return false
  }

  return !!name.match(/^([a-z0-9_-]{1,1000})$/i)
}

function getUserImageMap(username: string): ?URLMap {
  const info = _nameToURL[username]
  return info ? info.urlMap : null
}

function getTeamImageMap(teamname: string): ?URLMap {
  return getUserImageMap(teamname)
}

function loadTeamImageMap(teamname: string, callback: (teamname: string, urlMap: ?URLMap) => void) {
  loadUserImageMap(teamname, callback, true)
}

function loadUserImageMap(
  username: string,
  callback: (username: string, urlMap: ?URLMap) => void,
  isTeam: boolean = false
) {
  const info = _nameToURL[username] || _pendingNameToURL[username]
  if (info) {
    if (!info.done) {
      info.callbacks.push(callback)
    } else {
      setImmediate(() => {
        callback(username, info.urlMap)
      })
    }
  } else {
    _pendingNameToURL[username] = {
      callbacks: [callback],
      done: false,
      error: false,
      isTeam,
      requested: false,
      urlMap: null,
    }
    _getUserImages()
  }
}

function clearErrors() {
  Object.keys(_nameToURL).forEach(k => {
    if (_nameToURL[k] && _nameToURL[k].error) {
      delete _nameToURL[k]
    }
  })
}

export {getUserImageMap, loadUserImageMap, clearErrors, getTeamImageMap, loadTeamImageMap}
