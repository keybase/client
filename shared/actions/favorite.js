// @flow
import logger from '../logger'
import * as Constants from '../constants/favorite'
import * as Types from '../constants/types/favorite'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as FavoriteGen from './favorite-gen'
import {findKey, difference, partition, flatten} from 'lodash-es'
import {NotifyPopup} from '../native/notifications'

import type {TypedState} from '../constants/reducer'
import type {FolderRPCWithMeta} from '../constants/types/folders'

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
          devices: `Tell them to turn on${numDevices > 1 ? ':' : ' '} ${devices.join(', ')}${
            last ? ` or ${last}` : ''
          }.`,
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

function _folderToState(txt: string = '', username: string, loggedIn: boolean): Types.FolderState {
  const folders: Array<FolderRPCWithMeta> = _getFavoritesRPCToFolders(txt, username, loggedIn)

  const converted = folders
    .map(f => Constants.folderFromFolderRPCWithMeta(username, f))
    .sort((a, b) => _folderSort(username, a, b))

  const newFolders = converted.filter(f => f.meta === 'new')
  const privateBadge = newFolders.reduce((acc, f) => (!f.isPublic ? acc + 1 : acc), 0)
  const publicBadge = newFolders.reduce((acc, f) => (f.isPublic ? acc + 1 : acc), 0)
  const teamBadge = newFolders.reduce((acc, f) => (f.isTeam ? acc + 1 : acc), 0)

  const [teamFolders, adhocFolders] = partition(converted, {isTeam: true})
  const [priFolders, pubFolders] = partition(adhocFolders, {isPublic: false})
  const [privIgnored, priv] = partition(priFolders, {ignored: true})
  const [pubIgnored, pub] = partition(pubFolders, {ignored: true})
  const [teamIgnored, team] = partition(teamFolders, {ignored: true})
  return {
    privateBadge,
    publicBadge,
    teamBadge,
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
    team: {
      tlfs: team,
      ignored: teamIgnored,
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
    logger.warn('Invalid json from getFavorites: ', err)
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

function* _addOrIgnoreSaga(
  action: FavoriteGen.FavoriteAddPayload | FavoriteGen.FavoriteIgnorePayload
): Saga.SagaGenerator<any, any> {
  const folder = Constants.folderRPCFromPath(action.payload.path)
  const isAdd = action.type === FavoriteGen.favoriteAdd
  if (!folder) {
    const create = isAdd ? FavoriteGen.createFavoriteAddedError : FavoriteGen.createFavoriteIgnoredError
    yield Saga.put(create({errorText: 'No folder specified'}))
  } else {
    try {
      yield Saga.call(
        isAdd ? RPCTypes.favoriteFavoriteAddRpcPromise : RPCTypes.favoriteFavoriteIgnoreRpcPromise,
        {
          folder,
        }
      )
      yield Saga.put(FavoriteGen.createFavoriteAdded())
      yield Saga.put(FavoriteGen.createFavoriteList())
    } catch (error) {
      logger.warn('Err in favorite.favoriteAddOrIgnore', error)
    }
  }
}

function* _listSaga(): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  try {
    const results = yield Saga.call(RPCTypes.apiserverGetWithSessionRpcPromise, {
      args: [{key: 'problems', value: '1'}],
      endpoint: 'kbfs/favorite/list',
    })
    const username = state.config.username || ''
    const loggedIn = state.config.loggedIn
    const folders: Types.FolderState = _folderToState(results && results.body, username, loggedIn)

    yield Saga.put(FavoriteGen.createFavoriteListed({folders}))
    yield Saga.call(_notify, folders)
  } catch (e) {
    logger.warn('Error listing favorites:', e)
  }
}

// If the notify data has changed, show a popup
let previousNotifyState = []

function _notify(state: Types.FolderState): void {
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

// I think this can all go away, cc: @jzila
// const markTLFCreated = (state: TypedState, action: GregorGen.PushOOBMPayload) => {
// if (!state.config.username) {
// return
// }
// const messages = action.payload.messages.filter(i => i.system === 'kbfs.favorites')
// const createdTLFs = messages.map(m => JSON.parse(m.body.toString())).filter(m => m.action === 'create')
// const folderActions = createdTLFs.reduce((arr, m) => {
// const folder = m.tlf ? Constants.folderFromPath(state.config.username, m.tlf) : null

// if (folder) {
// arr.push(Saga.put(FavoriteGen.createMarkTLFCreated({folder})))
// return arr
// }
// logger.warn('Failed to parse tlf for oobm:')
// logger.debug('Failed to parse tlf for oobm:', m)
// return arr
// }, [])
// return Saga.all(folderActions)
// }

function* favoriteSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(FavoriteGen.favoriteList, _listSaga)
  yield Saga.safeTakeEvery([FavoriteGen.favoriteAdd, FavoriteGen.favoriteIgnore], _addOrIgnoreSaga)
  // yield Saga.actionToAction(GregorGen.pushOOBM, markTLFCreated)
}

export default favoriteSaga
