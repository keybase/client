// @flow
import * as Constants from '../constants/favorite'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import flatten from 'lodash/flatten'
import partition from 'lodash/partition'
import difference from 'lodash/difference'
import debounce from 'lodash/debounce'
import findKey from 'lodash/findKey'
import engine from '../engine'
import {NotifyPopup} from '../native/notifications'
import {badgeApp} from './notifications'
import {call, put, select} from 'redux-saga/effects'
import {isMobile} from '../constants/platform'

import type {Action} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'
import type {FolderRPCWithMeta} from '../constants/folders'

function favoriteSwitchTab(showingPrivate: boolean): Constants.FavoriteSwitchTab {
  return {type: Constants.favoriteSwitchTab, payload: {showingPrivate}, error: false}
}

function toggleShowIgnored(isPrivate: boolean): Constants.FavoriteToggleIgnored {
  return {type: Constants.favoriteToggleIgnored, payload: {isPrivate}, error: false}
}

function favoriteList(): Constants.FavoriteList {
  return {type: Constants.favoriteList, payload: undefined}
}

function favoriteFolder(path: string): Constants.FavoriteAdd {
  return {type: Constants.favoriteAdd, payload: {path}}
}

function ignoreFolder(path: string): Constants.FavoriteIgnore {
  return {type: Constants.favoriteIgnore, payload: {path}}
}

// TODO(mm) type properly
function markTLFCreated(folder: any): Constants.MarkTLFCreated {
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

function _folderToState(txt: string = '', username: string, loggedIn: boolean): Constants.FolderState {
  const folders: Array<FolderRPCWithMeta> = _getFavoritesRPCToFolders(txt, username, loggedIn)

  const converted = folders
    .map(f => Constants.folderFromFolderRPCWithMeta(username, f))
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

  // kill team folders for now
  json.favorites = json.favorites.filter(f => f.folderType !== RPCTypes.favoriteFolderType.team)

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
        folderType: isPrivate ? RPCTypes.favoriteFolderType.private : RPCTypes.favoriteFolderType.public,
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

function* _addSaga(action: Constants.FavoriteAdd): Saga.SagaGenerator<any, any> {
  const folder = Constants.folderRPCFromPath(action.payload.path)
  if (!folder) {
    const action: Constants.FavoriteAdded = {
      type: Constants.favoriteAdded,
      error: true,
      payload: {errorText: 'No folder specified'},
    }
    yield put(action)
  } else {
    try {
      yield call(RPCTypes.favoriteFavoriteAddRpcPromise, {param: {folder}})
      const action: Constants.FavoriteAdded = {type: Constants.favoriteAdded, payload: undefined}
      yield put(action)
      yield put(favoriteList())
    } catch (error) {
      console.warn('Err in favorite.favoriteAdd', error)
    }
  }
}

function* _ignoreSaga(action: Constants.FavoriteAdd): Saga.SagaGenerator<any, any> {
  const folder = Constants.folderRPCFromPath(action.payload.path)
  if (!folder) {
    const action: Constants.FavoriteIgnored = {
      type: Constants.favoriteIgnored,
      error: true,
      payload: {errorText: 'No folder specified'},
    }
    yield put(action)
  } else {
    try {
      yield call(RPCTypes.favoriteFavoriteIgnoreRpcPromise, {param: {folder}})
      const action: Constants.FavoriteIgnored = {type: Constants.favoriteIgnored, payload: undefined}
      yield put(action)
      yield put(favoriteList())
    } catch (error) {
      console.warn('Err in favorite.favoriteIgnore', error)
    }
  }
}

function* _listSaga(): Saga.SagaGenerator<any, any> {
  try {
    const results = yield call(RPCTypes.apiserverGetWithSessionRpcPromise, {
      param: {
        endpoint: 'kbfs/favorite/list',
        args: [{key: 'problems', value: '1'}],
      },
    })
    const username = yield select((state: TypedState) => state.config && state.config.username)
    const loggedIn = yield select((state: TypedState) => state.config && state.config.loggedIn)
    const state: Constants.FolderState = _folderToState(
      results && results.body,
      username || '',
      loggedIn || false
    )

    const listedAction: Constants.FavoriteListed = {type: Constants.favoriteListed, payload: {folders: state}}
    yield put(listedAction)
    yield call(_notify, state)
  } catch (e) {
    console.warn('Error listing favorites:', e)
  }
}

// If the notify data has changed, show a popup
let previousNotifyState = []

function _notify(state: Constants.FolderState): void {
  const total = state.publicBadge + state.privateBadge

  if (total) {
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
function* _setupKBFSChangedHandler(): Saga.SagaGenerator<any, any> {
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

  yield call(RPCTypes.NotifyFSRequestFSSyncStatusRequestRpcPromise, {param: {req: {requestID: 0}}})
}

function* favoriteSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(Constants.favoriteList, _listSaga)
  yield Saga.safeTakeEvery(Constants.favoriteAdd, _addSaga)
  yield Saga.safeTakeEvery(Constants.favoriteIgnore, _ignoreSaga)
  yield Saga.safeTakeEvery(Constants.setupKBFSChangedHandler, _setupKBFSChangedHandler)
}

export {favoriteFolder, favoriteList, ignoreFolder, markTLFCreated, favoriteSwitchTab, toggleShowIgnored}

export default favoriteSaga
