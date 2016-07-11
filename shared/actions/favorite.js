/* @flow */

import engine from '../engine'
import {navigateBack} from '../actions/router'
import * as Constants from '../constants/favorite'
import {defaultKBFSPath} from '../constants/config'
import {badgeApp} from './notifications'
import {canonicalizeUsernames, parseFolderNameToUsers} from '../util/kbfs'
import _ from 'lodash'
import type {Folder, favoriteGetFavoritesRpc, favoriteFavoriteAddRpc, favoriteFavoriteIgnoreRpc, FavoritesResult} from '../constants/types/flow-types'
import type {Dispatch} from '../constants/types/flux'
import type {FavoriteAdd, FavoriteList, FavoriteIgnore, State} from '../constants/favorite'
import type {UserList} from '../common-adapters/usernames'
import {NotifyPopup} from '../native/notifications'

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
  folder: Folder,
  meta: ?string
}

const folderToState = (folders: Array<FolderWithMeta>, username: string = ''): State => { // eslint-disable-line space-infix-ops
  let privateBadge = 0
  let publicBadge = 0

  const converted = folders.map(f => {
    const users = canonicalizeUsernames(username, parseFolderNameToUsers(f.folder.name))
      .map(u => ({
        username: u,
        you: u === username,
        broken: false,
      }))

    const {sortName, path} = pathFromFolder({users, isPublic: !f.folder.private})
    const groupAvatar = f.folder.private ? (users.length > 2) : (users.length > 1)
    const userAvatar = groupAvatar ? null : users[users.length - 1].username
    const meta = f.meta
    if (meta === 'new') {
      if (f.folder.private) {
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
      isPublic: !f.folder.private,
      groupAvatar,
      userAvatar,
      ignored,
      meta,
      recentFiles: [],
      waitingForParticipationUnlock: [],
      youCanUnlock: [],
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
let previousNotify = null

export function favoriteList (): (dispatch: Dispatch) => void {
  return (dispatch, getState) => {
    const params : favoriteGetFavoritesRpc = {
      method: 'favorite.getFavorites',
      callback: (error, favorites: FavoritesResult) => {
        if (error) {
          console.warn('Err in favorite.getFavorites', error)
          return
        }

        let folders = []

        if (favorites) {
          if (favorites.favoriteFolders) {
            favorites.favoriteFolders.forEach(f => {
              folders.push({folder: f, meta: null})
            })
          }

          if (favorites.newFolders) {
            favorites.newFolders.forEach(f => {
              folders.push({folder: f, meta: 'new'})
            })
          }

          if (favorites.ignoredFolders) {
            favorites.ignoredFolders.forEach(f => {
              folders.push({folder: f, meta: 'ignored'})
            })
          }
        }

        const config = getState && getState().config
        const currentUser = config && config.username
        const loggedIn = config && config.loggedIn

        // Ensure private/public folders exist for us
        if (currentUser && loggedIn) {
          [true, false].forEach(isPrivate => {
            const idx = folders.findIndex(f => f.folder.name === currentUser && f.folder.private === isPrivate)
            let toAdd = {meta: null, folder: {name: currentUser, private: isPrivate, notificationsOn: false, created: false}}

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

        const newNotify = {public: state.publicBadge, private: state.privateBadge}
        const total = state.publicBadge + state.privateBadge

        if (total && !_.isEqual(newNotify, previousNotify)) {
          previousNotify = newNotify

          let body

          if (total <= 3) {
            body = [].concat(state.private.tlfs || [], state.public.tlfs || [])
              .filter(t => t.meta === 'new')
              .map(t => t.path).join('\n')
          } else {
            body = `You have ${total} new folders`
          }

          NotifyPopup('New Keybase Folders!', {body}, 60 * 10)
        }
      },
    }
    engine.rpc(params)
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

    const params : favoriteFavoriteIgnoreRpc = {
      param: {folder},
      method: 'favorite.favoriteIgnore',
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
    }
    engine.rpc(params)
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

    const params : favoriteFavoriteAddRpc = {
      param: {folder},
      method: 'favorite.favoriteAdd',
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
    }
    engine.rpc(params)
  }
}
