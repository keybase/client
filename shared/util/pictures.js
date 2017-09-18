// @flow
import {apiserverGetRpcPromise} from '../constants/types/flow-types'
import throttle from 'lodash/throttle'
import partition from 'lodash/partition'

type URLMap = {[key: string]: string}
type Info = {
  urlMap: ?URLMap,
  callbacks: Array<(username: string, urlMap: ?URLMap) => void>,
  done: boolean,
  error: boolean,
  requesting: boolean,
}

const _nameToInfo: {[key: string]: ?Info} = {}

const _getPictures = (names: Array<string>, endpoint: string, paramName: string) => {
  if (!names.length) {
    return
  }

  names.forEach(n => {
    const info = _nameToInfo[n]
    if (info) {
      info.requesting = true
    }
  })

  apiserverGetRpcPromise({
    param: {
      args: [
        {key: paramName, value: names.join(',')},
        {key: 'formats', value: 'square_360,square_200,square_40'},
      ],
      endpoint,
    },
  })
    .then(response => {
      JSON.parse(response.body).pictures.forEach((picMap, idx) => {
        const name = names[idx]
        let urlMap = {
          ...(picMap['square_200'] ? {'200': picMap['square_200']} : null),
          ...(picMap['square_360'] ? {'360': picMap['square_360']} : null),
          ...(picMap['square_40'] ? {'40': picMap['square_40']} : null),
        }

        const info = _nameToInfo[name]
        if (info) {
          info.done = true
          info.error = false
          info.requesting = false
          info.urlMap = urlMap
          const callbacks = info.callbacks
          info.callbacks = []
          callbacks.forEach(cb => cb(name, info.urlMap))
        }
      })
    })
    .catch(() => {
      names.forEach(name => {
        const info = _nameToInfo[name]
        if (info) {
          info.done = true
          info.requesting = false
          info.error = true
          info.urlMap = {}
          const callbacks = info.callbacks
          info.callbacks = []
          callbacks.forEach(cb => cb(name, info.urlMap))
        }
      })
    })
}

const _getUserImages = throttle(() => {
  const names = Object.keys(_nameToInfo).filter(n => {
    const i = _nameToInfo[n]
    return i && !i.done && !i.requesting
  })

  const [good, bad] = partition(names, validUsername)

  bad.forEach(username => {
    const info = _nameToInfo[username]
    const urlMap = {}
    if (info) {
      info.requesting = false
      info.done = true
      info.error = true
      const cbs = info.callbacks
      info.callbacks = []
      cbs.forEach(cb => cb(username, urlMap))
    }
  })

  const [teamnames, usernames] = partition(good, n => _nameToInfo[n].isTeam)
  _getPictures(usernames, 'image/username_pic_lookups', 'usernames')
  _getPictures(teamnames, 'image/team_avatar_lookups', 'team_names')
}, 200)

function validUsername(name: ?string) {
  if (!name) {
    return false
  }

  return !!name.match(/^([.a-z0-9_-]{1,1000})$/i)
}

function getUserImageMap(username: string): ?URLMap {
  const info = _nameToInfo[username]
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
  const info = _nameToInfo[username]
  if (info) {
    if (!info.done) {
      info.callbacks.push(callback)
    } else {
      setImmediate(() => {
        callback(username, info.urlMap)
      })
    }
  } else {
    _nameToInfo[username] = {
      callbacks: [callback],
      done: false,
      error: false,
      isTeam,
      requesting: false,
      urlMap: null,
    }
    _getUserImages()
  }
}

function clearErrors() {
  Object.keys(_nameToInfo).forEach(k => {
    if (_nameToInfo[k] && _nameToInfo[k].error) {
      delete _nameToInfo[k]
    }
  })
}

export {getUserImageMap, loadUserImageMap, clearErrors, getTeamImageMap, loadTeamImageMap}
