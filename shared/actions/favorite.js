// @flow
import * as Constants from '../constants/favorite'
import _ from 'lodash'
import {NotifyPopup} from '../native/notifications'
import {apiserverGetRpcPromise, favoriteFavoriteAddRpcPromise, favoriteFavoriteIgnoreRpcPromise} from '../constants/types/flow-types'
import {badgeApp} from './notifications'
import {parseFolderNameToUsers, sortUserList} from '../util/kbfs'
import {navigateBack} from '../actions/router'
import {call, put, select} from 'redux-saga/effects'
import {takeLatest, takeEvery} from 'redux-saga'

import type {Action} from '../constants/types/flux'
import type {FavoriteAdd, FavoriteAdded, FavoriteList, FavoriteListed, FavoriteIgnore, FavoriteIgnored, FolderState, FavoriteSwitchTab, FavoriteToggleIgnored, FolderWithMeta} from '../constants/favorite'
import type {Folder as FoldersFolder, MetaType} from '../constants/folders'
import type {SagaGenerator} from '../constants/types/saga'

const {pathFromFolder, folderFromPath} = Constants

function switchTab (showingPrivate: boolean): FavoriteSwitchTab {
  return {type: Constants.favoriteSwitchTab, payload: {showingPrivate}, error: false}
}

function toggleShowIgnored (isPrivate: boolean): FavoriteToggleIgnored {
  return {type: Constants.favoriteToggleIgnored, payload: {isPrivate}, error: false}
}

function favoriteList (): FavoriteList {
  return {type: Constants.favoriteList, payload: undefined}
}

function favoriteFolder (path: string): FavoriteAdd {
  return {type: Constants.favoriteAdd, payload: {path}}
}

function ignoreFolder (path: string): FavoriteIgnore {
  return {type: Constants.favoriteIgnore, payload: {path}}
}

const injectMeta = type => f => { f.meta = type }

const _jsonToFolders = (json: Object, myKID: any): Array<FolderWithMeta> => {
  const folderSets = [json.favorites, json.ignored, json.new]
  const fillFolder = folder => {
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
  }

  folderSets.forEach(folders => folders.forEach(fillFolder))
  return _.flatten(folderSets)
}

function _folderSort (username, a, b) {
  // New first
  if (a.meta !== b.meta) {
    if (a.meta === 'new') return -1
    if (b.meta === 'new') return 1
  }

  // You next
  if (a.sortName === username) return -1
  if (b.sortName === username) return 1

  return a.sortName.localeCompare(b.sortName)
}

function _folderToState (txt: string = '', username: string, loggedIn: boolean): FolderState {
  const folders: Array<FolderWithMeta> = _getFavoritesRPCToFolders(txt, username, loggedIn)
  let privateBadge = 0
  let publicBadge = 0

  const converted: Array<FoldersFolder & {sortName: string}> = folders.map(f => {
    const users = sortUserList(parseFolderNameToUsers(username, f.name))

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
  }).sort((a, b) => _folderSort(username, a, b))

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

function * _addSaga (action: FavoriteAdd): SagaGenerator<any, any> {
  const folder = folderFromPath(action.payload.path)
  if (!folder) {
    const action: FavoriteAdded = {type: Constants.favoriteAdded, error: true, payload: {errorText: 'No folder specified'}}
    yield put(action)
    return
  } else {
    try {
      yield call(favoriteFavoriteAddRpcPromise, {param: {folder}})
      const action: FavoriteAdded = {type: Constants.favoriteAdded, payload: undefined}
      yield put(action)
      yield put(navigateBack())
    } catch (error) {
      console.warn('Err in favorite.favoriteAdd', error)
      yield put(navigateBack())
    }
  }
}

function * _ignoreSaga (action: FavoriteAdd): SagaGenerator<any, any> {
  const folder = folderFromPath(action.payload.path)
  if (!folder) {
    const action: FavoriteIgnored = {type: Constants.favoriteIgnored, error: true, payload: {errorText: 'No folder specified'}}
    yield put(action)
    return
  } else {
    try {
      yield call(favoriteFavoriteIgnoreRpcPromise, {param: {folder}})
      const action: FavoriteIgnored = {type: Constants.favoriteIgnored, payload: undefined}
      yield put(action)
      yield put(navigateBack())
    } catch (error) {
      console.warn('Err in favorite.favoriteIgnore', error)
      yield put(navigateBack())
    }
  }
}

function * _listSaga (): SagaGenerator<any, any> {
  const bail = yield select(({dev: {reloading = false} = {}}) => reloading)
  if (bail) {
    return
  }

  try {
    const results = yield call(apiserverGetRpcPromise, {
      param: {
        endpoint: 'kbfs/favorite/list',
        args: [{key: 'problems', value: '1'}],
      },
    })
    const username = yield select(state => state.config && state.config.username)
    const loggedIn = yield select(state => state.config && state.config.loggedIn)
    const state: FolderState = _folderToState(results && results.body, username || '', loggedIn || false)

    const listedAction: FavoriteListed = {type: Constants.favoriteListed, payload: {folders: state}}
    yield put(listedAction)

    const badgeAction: Action = badgeApp('newTLFs', !!(state.publicBadge || state.privateBadge))
    yield put(badgeAction)

    yield call(_notify, state)
  } catch (e) {
    console.warn('Error listing favorites:', e)
  }
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

function * favoriteSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.favoriteList, _listSaga),
    takeEvery(Constants.favoriteAdd, _addSaga),
    takeEvery(Constants.favoriteIgnore, _ignoreSaga),
  ]
}

export {
  favoriteList,
  toggleShowIgnored,
  switchTab,
  favoriteFolder,
  ignoreFolder,
}

export default favoriteSaga
