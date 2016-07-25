// @flow
import * as Constants from '../constants/favorite'
import _ from 'lodash'
import type {Dispatch} from '../constants/types/flux'
import type {FavoriteAdd, FavoriteList, FavoriteIgnore, FolderState} from '../constants/favorite'
import type {Folder} from '../constants/types/flow-types'
import type {ParticipantUnlock, Device, Folder as FoldersFolder, MetaType} from '../constants/folders'
import type {UserList} from '../common-adapters/usernames'
import {NotifyPopup} from '../native/notifications'
import {apiserverGetRpc, favoriteFavoriteAddRpc, favoriteFavoriteIgnoreRpc} from '../constants/types/flow-types'
import {badgeApp} from './notifications'
import {canonicalizeUsernames, parseFolderNameToUsers} from '../util/kbfs'
import {defaultKBFSPath} from '../constants/config'
import {navigateBack} from '../actions/router'

export function pathFromFolder ({isPublic, users}: {isPublic: boolean, users: UserList}) {
  const sortName = users.map(u => u.username).join(',')
  const path = `${defaultKBFSPath}/${isPublic ? 'public' : 'private'}/${sortName}`
  return {sortName, path}
}

function folderFromPath (path: string): ?Folder {
  if (path.startsWith(`${defaultKBFSPath}/private/`)) {
    return {
      name: path.replace(`${defaultKBFSPath}/private/`, ''),
      private: true,
      notificationsOn: false,
      created: false,
    }
  } else if (path.startsWith(`${defaultKBFSPath}/public/`)) {
    return {
      name: path.replace(`${defaultKBFSPath}/public/`, ''),
      private: false,
      notificationsOn: false,
      created: false,
    }
  } else {
    return null
  }
}

type FolderWithMeta = {
  meta: MetaType,
  waitingForParticipantUnlock: Array<ParticipantUnlock>,
  youCanUnlock: Array<Device>,
} & Folder

const folderToState = (folders: Array<FolderWithMeta>, username: string = ''): FolderState => { // eslint-disable-line space-infix-ops
  let privateBadge = 0
  let publicBadge = 0

  const converted: Array<FoldersFolder & {sortName: string}> = folders.map(f => {
    const users = canonicalizeUsernames(username, parseFolderNameToUsers(f.name))
      .map(u => ({
        username: u,
        you: u === username,
        broken: false,
      }))

    const {sortName, path} = pathFromFolder({users, isPublic: !f.private})
    const groupAvatar = f.private ? (users.length > 2) : (users.length > 1)
    const userAvatar = groupAvatar ? null : users[users.length - 1].username
    const meta: MetaType = f.meta
    if (meta === 'new') {
      if (f.private) {
        privateBadge++
      } else {
        publicBadge++
      }
    }
    const ignored = f.meta === 'ignored'
    return {
      path,
      users,
      sortName,
      hasData: false, // TODO don't have this info
      isPublic: !f.private,
      groupAvatar,
      userAvatar,
      ignored,
      meta,
      recentFiles: [],
      waitingForParticipantUnlock: f.waitingForParticipantUnlock,
      youCanUnlock: f.youCanUnlock,
    }
  }).sort((a, b) => {
    // New first
    if (a.meta !== b.meta) {
      if (a.meta === 'new') return -1
      if (b.meta === 'new') return 1
    }

    // You next
    if (a.sortName === username) return -1
    if (b.sortName === username) return 1

    return a.sortName.localeCompare(b.sortName)
  })

  const [priFolders, pubFolders] = _.partition(converted, {isPublic: false})
  const [privIgnored, priv] = _.partition(priFolders, {ignored: true})
  const [pubIgnored, pub] = _.partition(pubFolders, {ignored: true})
  return {
    privateBadge,
    publicBadge,
    private: {
      tlfs: priv,
      ignored: privIgnored,
      isPublic: false,
    },
    public: {
      tlfs: pub,
      ignored: pubIgnored,
      isPublic: true,
    },
  }
}

// If the notify data has changed, show a popup
let previousNotifyState = null

const injectMeta = type => f => { f.meta = type }

const jsonToFolders = (json: Object, myKID: any) => {
  const folderSets = [json.favorites, json.ignored, json.new]
  folderSets.forEach(folders => {
    folders.forEach(folder => {
      folder.waitingForParticipantUnlock = []
      folder.youCanUnlock = []

      if (folder.problem_set) {
        const solutions = folder.problem_set.solution_kids || {}
        if (Object.keys(solutions).length) {
          folder.meta = 'rekey'
        }

        if (folder.problem_set.can_self_help) {
          const mySolutions = solutions[myKID] || []
          folder.youCanUnlock = mySolutions.map(kid => {
            const device = json.devices[kid]
            return {...device, deviceID: kid}
          })
        } else {
          folder.waitingForParticipantUnlock = Object.keys(solutions).map(userID => {
            const devices = solutions[userID].map(kid => json.devices[kid].name)
            const numDevices = devices.length
            let last

            if (numDevices > 1) {
              last = devices.pop()
            }

            return {
              name: json.users[userID],
              devices: `Tell them to turn on${numDevices > 1 ? ':' : ' '} ${devices.join(', ')}${last ? ` or ${last}` : ''}.`,
            }
          })
        }
      }
    })
  })
  return _.flatten(folderSets)
}

export function favoriteList (): (dispatch: Dispatch, getState: () => Object) => void {
  return (dispatch, getState) => {
    apiserverGetRpc({
      param: {
        endpoint: 'kbfs/favorite/list',
        args: [{key: 'problems', value: '1'}],
      },
      callback: (error, result) => {
        if (error) {
          console.warn('Err in getFavorites', error)
          return
        }

        let json
        try {
          json = JSON.parse(result.body)
        } catch (err) {
          console.warn('Invalid json from getFavorites: ', err)
          return
        }

        const myUsername = getState().config && getState().config.username
        const myKID = _.findKey(json.users, name => name === myUsername)

        // inject our meta tag
        json.favorites && json.favorites.forEach(injectMeta(null))
        json.ignored && json.ignored.forEach(injectMeta('ignored'))
        json.new && json.new.forEach(injectMeta('new'))

        // figure out who can solve the rekey
        const folders: Array<FolderWithMeta> = jsonToFolders(json, myKID)
        const config = getState && getState().config
        const currentUser = config && config.username
        const loggedIn = config && config.loggedIn

        // Ensure private/public folders exist for us
        if (currentUser && loggedIn) {
          [true, false].forEach(isPrivate => {
            const idx = folders.findIndex(f => f.name === currentUser && f.private === isPrivate)
            let toAdd = {meta: null, name: currentUser, private: isPrivate, notificationsOn: false, created: false,
            waitingForParticipantUnlock: [], youCanUnlock: []}

            if (idx !== -1) {
              toAdd = folders[idx]
              folders.splice(idx, 1)
            }

            folders.unshift(toAdd)
          })
        }

        const state = folderToState(folders, currentUser)
        const action: FavoriteList = {type: Constants.favoriteList, payload: {folders: state}}
        dispatch(action)
        dispatch(badgeApp('newTLFs', !!(state.publicBadge || state.privateBadge)))

        const total = state.publicBadge + state.privateBadge

        if (total) {
          const newNotifyState = [].concat(state.private.tlfs || [], state.public.tlfs || [])
            .filter(t => t.meta === 'new').map(t => t.path)

          if (_.difference(newNotifyState, previousNotifyState).length) {
            let body
            if (total <= 3) {
              body = newNotifyState.join('\n')
            } else {
              body = `You have ${total} new folders`
            }

            NotifyPopup('New Keybase Folders!', {body}, 60 * 10)
          }

          previousNotifyState = newNotifyState
        }
      },
    })
  }
}

export function ignoreFolder (path: string): (dispatch: Dispatch) => void {
  return (dispatch, getState) => {
    const folder = folderFromPath(path)
    if (!folder) {
      const action: FavoriteIgnore = {type: Constants.favoriteIgnore, error: true, payload: {errorText: 'No folder specified'}}
      dispatch(action)
      return
    }

    favoriteFavoriteIgnoreRpc({
      param: {folder},
      callback: error => {
        if (error) {
          console.warn('Err in favorite.favoriteIgnore', error)
          dispatch(navigateBack())
          return
        }
        const action: FavoriteIgnore = {type: Constants.favoriteIgnore, payload: undefined}
        dispatch(action)
        dispatch(navigateBack())
      },
    })
  }
}

export function favoriteFolder (path: string): (dispatch: Dispatch) => void {
  return (dispatch, getState) => {
    const folder = folderFromPath(path)
    if (!folder) {
      const action: FavoriteAdd = {type: Constants.favoriteAdd, error: true, payload: {errorText: 'No folder specified'}}
      dispatch(action)
      return
    }

    favoriteFavoriteAddRpc({
      param: {folder},
      callback: error => {
        if (error) {
          console.warn('Err in favorite.favoriteAdd', error)
          dispatch(navigateBack())
          return
        }
        const action: FavoriteAdd = {type: Constants.favoriteAdd, payload: undefined}
        dispatch(action)
        dispatch(navigateBack())
      },
    })
  }
}

export function switchTab (showingPrivate: boolean) {
  return {type: Constants.favoriteSwitchTab, payload: {showingPrivate}, error: false}
}
