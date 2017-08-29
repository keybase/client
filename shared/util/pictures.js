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

const _getTeamPictures = (teamnames: Array<string>) => {
  if (!teamnames.length) {
    return
  }

  teamnames.forEach(n => {
    const info = _nameToInfo[n]
    if (info) {
      info.requesting = true
    }
  })

  apiserverGetRpcPromise({
    param: {
      args: [
        {key: 'team_names', value: teamnames.join(',')},
        {key: 'formats', value: 'square_360,square_200,square_40'},
      ],
      endpoint: 'image/team_avatar_lookups',
    },
  })
    .then(response => {
      JSON.parse(response.body).pictures.forEach((picMap, idx) => {
        const teamname = teamnames[idx]
        let urlMap = {
          ...(picMap['square_200'] ? {'200': picMap['square_200']} : null),
          ...(picMap['square_360'] ? {'360': picMap['square_360']} : null),
          ...(picMap['square_40'] ? {'40': picMap['square_40']} : null),
        }

        const info = _nameToInfo[teamname]
        if (info) {
          info.done = true
          info.requesting = false
          info.urlMap = urlMap
          info.callbacks.forEach(cb => cb(teamname, urlMap))
          info.callbacks = []
        }
      })
    })
    .catch(() => {
      teamnames.forEach(teamname => {
        const info = _nameToInfo[teamname]
        const urlMap = {}
        if (info) {
          info.done = true
          info.error = true
          info.callbacks.forEach(cb => cb(teamname, urlMap))
          info.callbacks = []
        }
      })
    })
}

const _getUsernamePictures = (usernames: Array<string>) => {
  if (!usernames.length) {
    return
  }

  usernames.forEach(n => {
    const info = _nameToInfo[n]
    if (info) {
      info.requesting = true
    }
  })

  apiserverGetRpcPromise({
    param: {
      args: [
        {key: 'usernames', value: usernames.join(',')},
        {key: 'formats', value: 'square_360,square_200,square_40'},
      ],
      endpoint: 'image/username_pic_lookups',
    },
  })
    .then(response => {
      JSON.parse(response.body).pictures.forEach((picMap, idx) => {
        const username = usernames[idx]
        let urlMap = {
          ...(picMap['square_200'] ? {'200': picMap['square_200']} : null),
          ...(picMap['square_360'] ? {'360': picMap['square_360']} : null),
          ...(picMap['square_40'] ? {'40': picMap['square_40']} : null),
        }

        const info = _nameToInfo[username]
        if (info) {
          info.done = true
          info.requesting = false
          info.urlMap = urlMap
          info.callbacks.forEach(cb => cb(username, urlMap))
          info.callbacks = []
        }
      })
    })
    .catch(() => {
      usernames.forEach(username => {
        const info = _nameToInfo[username]
        const urlMap = {}
        if (info) {
          info.done = true
          info.error = true
          info.callbacks.forEach(cb => cb(username, urlMap))
          info.callbacks = []
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

  const [teamnames, usernames] = partition(good || [], n => _nameToInfo[n].isTeam)
  _getUsernamePictures(usernames)
  _getTeamPictures(teamnames)
}, 200)

function validUsername(name: ?string) {
  if (!name) {
    return false
  }

  return !!name.match(/^([a-z0-9_-]{1,1000})$/i)
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
