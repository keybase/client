// @flow
import * as ConfigGen from './config-gen'
import * as Types from '../constants/types/gregor'
import * as FavoriteGen from './favorite-gen'
import * as GitGen from './git-gen'
import * as GregorGen from './gregor-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import engine from '../engine'
import {clearErrors} from '../util/pictures'
import {folderFromPath} from '../constants/favorite.js'
import {nativeReachabilityEvents} from '../util/reachability'
import {replaceEntity} from './entities'
import {type Dispatch} from '../constants/types/flux'
import {type SagaGenerator} from '../constants/types/saga'
import {type State as GregorState, type OutOfBandMessage} from '../constants/types/flow-types-gregor'
import {type TypedState} from '../constants/reducer'
import {usernameSelector, loggedInSelector} from '../constants/selectors'

function isTlfItem(gItem: Types.NonNullGregorItem): boolean {
  return !!(gItem && gItem.item && gItem.item.category && gItem.item.category === 'tlf')
}

function toNonNullGregorItems(state: GregorState): Array<Types.NonNullGregorItem> {
  if (!state.items) {
    return []
  }

  // We need to do this in two steps because flow understands filter(Boolean)
  // can un-Maybe a type, but it doesn't understand general predicates.
  return state.items
    .map(x => {
      const md = x.md
      const item = x.item
      // Gotta copy the object because flow is VERY UNCHILL about casting these maybes.
      return md && item ? {md, item} : null
    })
    .filter(Boolean)
}

function registerReachability() {
  return (dispatch: Dispatch, getState: () => TypedState) => {
    engine().setIncomingHandler('keybase.1.reachability.reachabilityChanged', ({reachability}, response) => {
      // Gregor reachability is only valid if we're logged in
      // TODO remove this when core stops sending us these when we're logged out
      if (loggedInSelector(getState())) {
        dispatch(GregorGen.createUpdateReachability({reachability}))

        if (reachability.reachable === RPCTypes.reachabilityReachable.yes) {
          // TODO: We should be able to recover from connection problems
          // without re-bootstrapping. Originally we used to do this on HTML5
          // 'online' event, but reachability is more precise.
          dispatch(ConfigGen.createBootstrap({isReconnect: true}))
          clearErrors()
        }
      }
    })

    dispatch(checkReachabilityOnConnect())
  }
}

function listenForNativeReachabilityEvents(dispatch: Dispatch) {
  return dispatch(nativeReachabilityEvents)
}

function checkReachabilityOnConnect() {
  return (dispatch: Dispatch) => {
    // The startReachibility RPC call both starts and returns the current
    // reachability state. Then we'll get updates of changes from this state
    // via reachabilityChanged.
    // This should be run on app start and service re-connect in case the
    // service somehow crashed or was restarted manually.
    RPCTypes.reachabilityStartReachabilityRpcPromise()
      .then(reachability => {
        dispatch(GregorGen.createUpdateReachability({reachability}))
      })
      .catch(err => {
        console.warn('error bootstrapping reachability: ', err)
      })
  }
}

function registerGregorListeners() {
  return (dispatch: Dispatch) => {
    RPCTypes.delegateUiCtlRegisterGregorFirehoseRpcPromise()
      .then(response => {
        console.log('Registered gregor listener')
      })
      .catch(error => {
        console.warn('error in registering gregor listener: ', error)
      })

    // we get this with sessionID == 0 if we call openDialog
    engine().setIncomingHandler('keybase.1.gregorUI.pushState', ({state, reason}, response) => {
      dispatch(GregorGen.createPushState({state, reason}))
      response && response.result()
    })

    engine().setIncomingHandler('keybase.1.gregorUI.pushOutOfBandMessages', ({oobm}, response) => {
      if (oobm && oobm.length) {
        const filteredOOBM = oobm.filter(oobm => !!oobm)
        if (filteredOOBM.length) {
          dispatch(GregorGen.createPushOOBM({messages: filteredOOBM}))
        }
      }
      response && response.result()
    })
  }
}

function* handleTLFUpdate(items: Array<Types.NonNullGregorItem>): SagaGenerator<any, any> {
  const seenMsgs: Types.MsgMap = yield Saga.select((state: TypedState) => state.gregor.seenMsgs)

  // Check if any are a tlf items
  const tlfUpdates = items.filter(isTlfItem)
  const newTlfUpdates = tlfUpdates.filter(gItem => !seenMsgs[gItem.md.msgID.toString('base64')])
  if (newTlfUpdates.length) {
    yield Saga.put(GregorGen.createUpdateSeenMsgs({seenMsgs: newTlfUpdates}))
    yield Saga.put(FavoriteGen.createFavoriteList())
  }
}

function* handleChatBanner(items: Array<Types.NonNullGregorItem>): SagaGenerator<any, any> {
  const sawChatBanner = items.find(i => i.item && i.item.category === 'sawChatBanner')
  if (sawChatBanner) {
    // TODO move this to teams eventually
    yield Saga.put(replaceEntity(['teams'], I.Map([['sawChatBanner', true]])))
  }
}

function* _handlePushState(pushAction: GregorGen.PushStatePayload): SagaGenerator<any, any> {
  if (!pushAction.error) {
    const {payload: {state}} = pushAction
    const nonNullItems = toNonNullGregorItems(state)
    if (nonNullItems.length !== (state.items || []).length) {
      console.warn('Lost some messages in filtering out nonNull gregor items')
    }

    yield Saga.call(handleTLFUpdate, nonNullItems)
    yield Saga.call(handleChatBanner, nonNullItems)
  } else {
    console.log('Error in gregor pushState', pushAction.payload)
  }
}

function* handleKbfsFavoritesOOBM(kbfsFavoriteMessages: Array<OutOfBandMessage>): Generator<any, void, any> {
  const createdTLFs: Array<{action: string, tlf: ?string}> = kbfsFavoriteMessages
    .map(m => JSON.parse(m.body.toString()))
    .filter(m => m.action === 'create')

  const state: TypedState = yield Saga.select()
  const username = usernameSelector(state)
  if (!username) {
    return
  }
  const folderActions = createdTLFs.reduce((arr, m) => {
    const folder = m.tlf ? folderFromPath(username, m.tlf) : null

    if (folder) {
      arr.push(Saga.put(FavoriteGen.createMarkTLFCreated({folder})))
      return arr
    }
    console.warn('Failed to parse tlf for oobm:', m)
    return arr
  }, [])
  yield Saga.all(folderActions)
}

function* _handlePushOOBM(pushOOBM: GregorGen.PushOOBMPayload) {
  if (!pushOOBM.error) {
    const {payload: {messages}} = pushOOBM

    // Filter first so we don't dispatch unnecessary actions
    const gitMessages = messages.filter(i => i.system === 'git')
    if (gitMessages.length > 0) {
      yield Saga.put(GitGen.createHandleIncomingGregor({messages: gitMessages}))
    }

    yield Saga.call(handleKbfsFavoritesOOBM, messages.filter(i => i.system === 'kbfs.favorites'))
  } else {
    console.log('Error in gregor oobm', pushOOBM.payload)
  }
}

function* _handleCheckReachability(action: GregorGen.CheckReachabilityPayload): SagaGenerator<any, any> {
  const reachability = yield Saga.call(RPCTypes.reachabilityCheckReachabilityRpcPromise)
  yield Saga.put(GregorGen.createUpdateReachability({reachability}))
}

function* _injectItem(action: GregorGen.InjectItemPayload): SagaGenerator<any, any> {
  const {category, body, dtime} = action.payload
  yield Saga.call(RPCTypes.gregorInjectItemRpcPromise, {
    body,
    cat: category,
    dtime: {
      time: dtime || 0,
      offset: 0,
    },
  })
}

function* gregorSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(GregorGen.pushState, _handlePushState)
  yield Saga.safeTakeEvery(GregorGen.pushOOBM, _handlePushOOBM)
  yield Saga.safeTakeEvery(GregorGen.injectItem, _injectItem)
  yield Saga.safeTakeLatest(GregorGen.checkReachability, _handleCheckReachability)
}

export {
  checkReachabilityOnConnect,
  registerGregorListeners,
  registerReachability,
  listenForNativeReachabilityEvents,
}

export default gregorSaga
