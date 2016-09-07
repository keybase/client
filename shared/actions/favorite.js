// @flow
import * as Constants from '../constants/favorite'
import _ from 'lodash'
import {NotifyPopup} from '../native/notifications'
import {apiserverGetRpc, favoriteFavoriteAddRpc, favoriteFavoriteIgnoreRpc} from '../constants/types/flow-types'
import {badgeApp} from './notifications'
import {canonicalizeUsernames, parseFolderNameToUsers} from '../util/kbfs'
import {navigateBack} from '../actions/router'
import {call, put, select} from 'redux-saga/effects'
import {takeLatest} from 'redux-saga'

import type {Dispatch, Action} from '../constants/types/flux'
import type {FavoriteAdd, FavoriteList, FavoriteIgnore, FolderState, FavoriteSwitchTab, FavoriteToggleIgnored, FavoriteGet, FolderWithMeta} from '../constants/favorite'
import type {Folder as FoldersFolder, MetaType} from '../constants/folders'
import type {SagaGenerator} from '../constants/types/saga'

const {pathFromFolder, folderFromPath} = Constants

function switchTab (showingPrivate: boolean): FavoriteSwitchTab {
  return {type: Constants.favoriteSwitchTab, payload: {showingPrivate}, error: false}
}

function toggleShowIgnored (isPrivate: boolean): FavoriteToggleIgnored {
  return {type: Constants.favoriteToggleIgnored, payload: {isPrivate}, error: false}
}

const injectMeta = type => f => { f.meta = type }

const _jsonToFolders = (json: Object, myKID: any): Array<FolderWithMeta> => {
  const folderSets = [json.favorites, json.ignored, json.new]

  folderSets.forEach(folders => {
    folders.forEach(folder => {
      folder.waitingForParticipantUnlock = []
      folder.youCanUnlock = []

      if (!folder.problem_set) {
        return
      }

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
          const last = numDevices > 1 ? devices.pop() : null

          return {
            name: json.users[userID],
            devices: `Tell them to turn on${numDevices > 1 ? ':' : ' '} ${devices.join(', ')}${last ? ` or ${last}` : ''}.`,
          }
        })
      }
    })
  })
  return _.flatten(folderSets)
}

function favoriteList (): FavoriteGet {
  return {
    type: Constants.favoriteGet,
    payload: undefined,
  }
}

function _getFavoritesRPC (): Promise<any> {
  return new Promise((resolve, reject) => {
    apiserverGetRpc({
      param: {
        endpoint: 'kbfs/favorite/list',
        args: [{key: 'problems', value: '1'}],
      },
      callback: (error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      },
    })
  })
}

function _folderToState (txt: string = '', username: string, loggedIn: boolean): FolderState {
  const folders: Array<FolderWithMeta> = _getFavoritesRPCToFolders(txt, username, loggedIn)
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

function _getFavoritesRPCToFolders (txt: string, username: string = '', loggedIn: boolean): Array<FolderWithMeta> {
  let json
  try {
    json = JSON.parse(txt)
  } catch (err) {
    console.warn('Invalid json from getFavorites: ', err)
    return []
  }

  const myKID = _.findKey(json.users, name => name === username)

  // inject our meta tag
  json.favorites && json.favorites.forEach(injectMeta(null))
  json.ignored && json.ignored.forEach(injectMeta('ignored'))
  json.new && json.new.forEach(injectMeta('new'))

  // figure out who can solve the rekey
  const folders: Array<FolderWithMeta> = _jsonToFolders(json, myKID)

  // Ensure private/public folders exist for us
  if (username && loggedIn) {
    [true, false].forEach(isPrivate => {
      const idx = folders.findIndex(f => f.name === username && f.private === isPrivate)
      let toAdd = {
        meta: null,
        name: username,
        private: isPrivate,
        notificationsOn: false,
        created: false,
        waitingForParticipantUnlock: [],
        youCanUnlock: [],
      }

      if (idx !== -1) {
        toAdd = folders[idx]
        folders.splice(idx, 1)
      }

      folders.unshift(toAdd)
    })
  }

  return folders
}

function * getFavoritesListSaga (): SagaGenerator<any, any> {
  const bail = yield select(({dev: {reloading = false} = {}}) => reloading)
  if (bail) {
    return
  }

  const results = yield call(_getFavoritesRPC)
  const username = yield select(state => state.config && state.config.username)
  const loggedIn = yield select(state => state.config && state.config.loggedIn)
  const state: FolderState = _folderToState(results && results.body, username || '', loggedIn || false)

  const listAction: FavoriteList = {type: Constants.favoriteList, payload: {folders: state}}
  yield put(listAction)

  const badgeAction: Action = badgeApp('newTLFs', !!(state.publicBadge || state.privateBadge))
  yield put(badgeAction)

  yield call(_notify, state)
}

// If the notify data has changed, show a popup
let previousNotifyState = null

function _notify (state) {
  const total = state.publicBadge + state.privateBadge

  if (!total) {
    return
  }

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

function ignoreFolder (path: string): (dispatch: Dispatch) => void {
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

function favoriteFolder (path: string): (dispatch: Dispatch) => void {
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

function * _favoriteSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.favoriteGet, getFavoritesListSaga),
  ]
}

export {
  favoriteList,
  toggleShowIgnored,
  switchTab,
  favoriteFolder,
  ignoreFolder,
}

export default _favoriteSaga
