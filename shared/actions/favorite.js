// @flow
import * as Constants from '../constants/favorite'
import {folderTab} from '../constants/tabs'
import {defaultKBFSPath, defaultPublicPrefix} from '../constants/config'
import flatten from 'lodash/flatten'
import partition from 'lodash/partition'
import difference from 'lodash/difference'
import debounce from 'lodash/debounce'
import findKey from 'lodash/findKey'
import engine from '../engine'
import {NotifyPopup} from '../native/notifications'
import {
  apiserverGetWithSessionRpcPromise,
  favoriteFavoriteAddRpcPromise,
  favoriteFavoriteIgnoreRpcPromise,
  FavoriteFolderType,
  NotifyFSRequestFSSyncStatusRequestRpcPromise,
} from '../constants/types/flow-types'
import {badgeApp} from './notifications'
import {navigateTo} from '../actions/route-tree'
import {call, put, select} from 'redux-saga/effects'
import {safeTakeLatest, safeTakeEvery} from '../util/saga'
import {isMobile} from '../constants/platform'

import type {Action} from '../constants/types/flux'
import type {
  FavoriteAdd,
  FavoriteAdded,
  FavoriteList,
  FavoriteListed,
  FavoriteIgnore,
  FavoriteIgnored,
  FolderState,
  FavoriteSwitchTab,
  FavoriteToggleIgnored,
  MarkTLFCreated,
  SetupKBFSChangedHandler,
} from '../constants/favorite'
import type {FolderRPCWithMeta} from '../constants/folders'
import type {SagaGenerator} from '../constants/types/saga'

const {folderFromFolderRPCWithMeta, folderRPCFromPath} = Constants

function setupKBFSChangedHandler(): SetupKBFSChangedHandler {
  return {type: Constants.setupKBFSChangedHandler, payload: undefined}
}

function favoriteSwitchTab(showingPrivate: boolean): FavoriteSwitchTab {
  return {type: Constants.favoriteSwitchTab, payload: {showingPrivate}, error: false}
}

function toggleShowIgnored(isPrivate: boolean): FavoriteToggleIgnored {
  return {type: Constants.favoriteToggleIgnored, payload: {isPrivate}, error: false}
}

function favoriteList(): FavoriteList {
  return {type: Constants.favoriteList, payload: undefined}
}

function favoriteFolder(path: string): FavoriteAdd {
  return {type: Constants.favoriteAdd, payload: {path}}
}

function ignoreFolder(path: string): FavoriteIgnore {
  return {type: Constants.favoriteIgnore, payload: {path}}
}

// TODO(mm) type properly
function markTLFCreated(folder: any): MarkTLFCreated {
  return {type: Constants.markTLFCreated, payload: {folder}}
}

const injectMeta = type => f => {
  f.meta = type
}

const _jsonToFolders = (json: Object, myKID: any): Array<FolderRPCWithMeta> => {
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
  return flatten(folderSets)
}

function _folderSort(username, a, b) {
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

function _folderToState(txt: string = '', username: string, loggedIn: boolean): FolderState {
  const folders: Array<FolderRPCWithMeta> = _getFavoritesRPCToFolders(txt, username, loggedIn)

  const converted = folders
    .map(f => folderFromFolderRPCWithMeta(username, f))
    .sort((a, b) => _folderSort(username, a, b))

  const newFolders = converted.filter(f => f.meta === 'new')
  const privateBadge = newFolders.reduce((acc, f) => (!f.isPublic ? acc + 1 : acc), 0)
  const publicBadge = newFolders.reduce((acc, f) => (f.isPublic ? acc + 1 : acc), 0)

  const [priFolders, pubFolders] = partition(converted, {isPublic: false})
  const [privIgnored, priv] = partition(priFolders, {ignored: true})
  const [pubIgnored, pub] = partition(pubFolders, {ignored: true})
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

function _getFavoritesRPCToFolders(
  txt: string,
  username: string = '',
  loggedIn: boolean
): Array<FolderRPCWithMeta> {
  let json
  try {
    json = JSON.parse(txt)
  } catch (err) {
    console.warn('Invalid json from getFavorites: ', err)
    return []
  }

  const myKID = findKey(json.users, name => name === username)

  // inject our meta tag
  json.favorites && json.favorites.forEach(injectMeta(null))
  json.ignored && json.ignored.forEach(injectMeta('ignored'))
  json.new && json.new.forEach(injectMeta('new'))

  // figure out who can solve the rekey
  const folders: Array<FolderRPCWithMeta> = _jsonToFolders(json, myKID)

  // Ensure private/public folders exist for us
  if (username && loggedIn) {
    ;[true, false].forEach(isPrivate => {
      const idx = folders.findIndex(f => f.name === username && f.private === isPrivate)
      let toAdd = {
        meta: null,
        name: username,
        private: isPrivate,
        notificationsOn: false,
        created: false,
        waitingForParticipantUnlock: [],
        youCanUnlock: [],
        folderType: isPrivate ? FavoriteFolderType.private : FavoriteFolderType.public,
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

function* _addSaga(action: FavoriteAdd): SagaGenerator<any, any> {
  const path = action.payload.path
  const folder = folderRPCFromPath(path)
  if (!folder) {
    const action: FavoriteAdded = {
      type: Constants.favoriteAdded,
      error: true,
      payload: {errorText: 'No folder specified'},
    }
    yield put(action)
  } else {
    try {
      yield call(favoriteFavoriteAddRpcPromise, {param: {folder}})
      const action: FavoriteAdded = {type: Constants.favoriteAdded, payload: undefined}
      yield put(action)
      yield put(favoriteList())
      yield call(_navigateToFolder, path)
    } catch (error) {
      console.warn('Err in favorite.favoriteAdd', error)
      yield call(_navigateToFolder, path)
    }
  }
}

function* _ignoreSaga(action: FavoriteAdd): SagaGenerator<any, any> {
  const path = action.payload.path
  const folder = folderRPCFromPath(path)
  if (!folder) {
    const action: FavoriteIgnored = {
      type: Constants.favoriteIgnored,
      error: true,
      payload: {errorText: 'No folder specified'},
    }
    yield put(action)
  } else {
    try {
      yield call(favoriteFavoriteIgnoreRpcPromise, {param: {folder}})
      const action: FavoriteIgnored = {type: Constants.favoriteIgnored, payload: undefined}
      yield put(action)
      yield put(favoriteList())
      yield call(_navigateToFolder, path)
    } catch (error) {
      console.warn('Err in favorite.favoriteIgnore', error)
      yield call(_navigateToFolder, path)
    }
  }
}

function* _navigateToFolder(path: string) {
  if (path.startsWith(defaultKBFSPath + defaultPublicPrefix)) {
    yield put(navigateTo([folderTab, 'public']))
  } else {
    yield put(navigateTo([folderTab, 'private']))
  }
}

function* _listSaga(): SagaGenerator<any, any> {
  const bail = yield select(({dev: {reloading = false} = {}}) => reloading)
  if (bail) {
    return
  }

  try {
    const results = yield call(apiserverGetWithSessionRpcPromise, {
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

    yield call(_notify, state)
  } catch (e) {
    console.warn('Error listing favorites:', e)
  }
}

// If the notify data has changed, show a popup
let previousNotifyState = null

function _notify(state) {
  const total = state.publicBadge + state.privateBadge

  if (!total) {
    return
  }

  const newNotifyState = []
    .concat(state.private.tlfs || [], state.public.tlfs || [])
    .filter(t => t.meta === 'new')
    .map(t => t.path)

  if (difference(newNotifyState, previousNotifyState).length) {
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

// Don't send duplicates else we get high cpu usage
let _kbfsUploadingState = false
function* _setupKBFSChangedHandler(): SagaGenerator<any, any> {
  yield put((dispatch: Dispatch) => {
    const debouncedKBFSStopped = debounce(() => {
      if (_kbfsUploadingState === true) {
        _kbfsUploadingState = false
        const badgeAction: Action = badgeApp('kbfsUploading', false)
        dispatch(badgeAction)
        dispatch({type: Constants.kbfsStatusUpdated, payload: {isAsyncWriteHappening: false}})
      }
    }, 2000)

    if (!isMobile) {
      engine().setIncomingHandler('keybase.1.NotifyFS.FSSyncActivity', ({status}) => {
        // This has a lot of missing data from the KBFS side so for now we just have a timeout that sets this to off
        // ie. we don't get the syncingBytes or ops correctly (always zero)
        if (_kbfsUploadingState === false) {
          _kbfsUploadingState = true
          const badgeAction: Action = badgeApp('kbfsUploading', true)
          dispatch(badgeAction)
          dispatch({type: Constants.kbfsStatusUpdated, payload: {isAsyncWriteHappening: true}})
        }
        // We have to debounce while the events are still happening no matter what
        debouncedKBFSStopped()
      })
    }
  })

  yield call(NotifyFSRequestFSSyncStatusRequestRpcPromise, {param: {req: {requestID: 0}}})
}

function* favoriteSaga(): SagaGenerator<any, any> {
  yield safeTakeLatest(Constants.favoriteList, _listSaga)
  yield safeTakeEvery(Constants.favoriteAdd, _addSaga)
  yield safeTakeEvery(Constants.favoriteIgnore, _ignoreSaga)
  yield safeTakeEvery(Constants.setupKBFSChangedHandler, _setupKBFSChangedHandler)
}

export {
  favoriteFolder,
  favoriteList,
  ignoreFolder,
  markTLFCreated,
  setupKBFSChangedHandler,
  favoriteSwitchTab,
  toggleShowIgnored,
}

export default favoriteSaga
