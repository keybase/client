// @flow

import * as Constants from '../constants/gregor'
import engine from '../engine'
import {call, put, select} from 'redux-saga/effects'
import {delegateUiCtlRegisterGregorFirehoseRpc, reachabilityCheckReachabilityRpcPromise, reachabilityStartReachabilityRpc, ReachabilityReachable} from '../constants/types/flow-types'
import {favoriteList, markTLFCreated} from './favorite'
import {folderFromPath} from '../constants/favorite.js'
import {bootstrap} from '../actions/config'
import {safeTakeEvery, safeTakeLatest} from '../util/saga'
import {clearErrors} from '../util/pictures'
import {usernameSelector, loggedInSelector} from '../constants/selectors'
import {nativeReachabilityEvents} from '../util/reachability'

import type {CheckReachability, PushState, PushOOBM, UpdateReachability, UpdateSeenMsgs, MsgMap, NonNullGregorItem} from '../constants/gregor'
import type {Dispatch} from '../constants/types/flux'
import type {PushReason, Reachability} from '../constants/types/flow-types'
import type {State as GregorState, ItemAndMetadata as GregorItem, OutOfBandMessage} from '../constants/types/flow-types-gregor'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

function pushState (state: GregorState, reason: PushReason): PushState {
  return {type: Constants.pushState, payload: {state, reason}}
}

function pushOOBM (messages: Array<OutOfBandMessage>): PushOOBM {
  return {type: Constants.pushOOBM, payload: {messages}}
}

function updateReachability (reachability: Reachability): UpdateReachability {
  return {type: Constants.updateReachability, payload: {reachability}}
}

function checkReachability (): CheckReachability {
  return {type: Constants.checkReachability, payload: undefined}
}

function updateSeenMsgs (seenMsgs: Array<NonNullGregorItem>): UpdateSeenMsgs {
  return {type: Constants.updateSeenMsgs, payload: {seenMsgs}}
}

function isTlfItem (gItem: GregorItem): boolean {
  return !!(gItem && gItem.item && gItem.item.category && gItem.item.category === 'tlf')
}

function toNonNullGregorItems (state: GregorState): Array<NonNullGregorItem> {
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

function registerReachability () {
  return (dispatch: Dispatch, getState: () => TypedState) => {
    engine().setIncomingHandler('keybase.1.reachability.reachabilityChanged', ({reachability}, response) => {
      // Gregor reachability is only valid if we're logged in
      // TODO remove this when core stops sending us these when we're logged out
      if (loggedInSelector(getState())) {
        dispatch(updateReachability(reachability))

        if (reachability.reachable === ReachabilityReachable.yes) {
          // TODO: We should be able to recover from connection problems
          // without re-bootstrapping. Originally we used to do this on HTML5
          // 'online' event, but reachability is more precise.
          dispatch(bootstrap({isReconnect: true}))
          clearErrors()
        }
      }
    })

    dispatch(checkReachabilityOnConnect())
  }
}

function listenForNativeReachabilityEvents (dispatch: Dispatch) {
  return dispatch(nativeReachabilityEvents)
}

function checkReachabilityOnConnect () {
  return (dispatch: Dispatch) => {
    // The startReachibility RPC call both starts and returns the current
    // reachability state. Then we'll get updates of changes from this state
    // via reachabilityChanged.
    // This should be run on app start and service re-connect in case the
    // service somehow crashed or was restarted manually.
    reachabilityStartReachabilityRpc({
      callback: (err, reachability) => {
        if (err) {
          console.warn('error bootstrapping reachability: ', err)
          return
        }
        dispatch(updateReachability(reachability))
      },
    })
  }
}

function registerGregorListeners () {
  return (dispatch: Dispatch) => {
    delegateUiCtlRegisterGregorFirehoseRpc({
      callback: (error, response) => {
        if (error != null) {
          console.warn('error in registering gregor listener: ', error)
        } else {
          console.log('Registered gregor listener')
        }
      },
    })

    // we get this with sessionID == 0 if we call openDialog
    engine().setIncomingHandler('keybase.1.gregorUI.pushState', ({state, reason}, response) => {
      dispatch(pushState(state, reason))
      response && response.result()
    })

    engine().setIncomingHandler('keybase.1.gregorUI.pushOutOfBandMessages', ({oobm}, response) => {
      if (oobm && oobm.length) {
        const filteredOOBM = oobm.filter(oobm => !!oobm)
        if (filteredOOBM.length) {
          dispatch(pushOOBM(filteredOOBM))
        }
      }
      response && response.result()
    })
  }
}

function * handleTLFUpdate (items: Array<NonNullGregorItem>): SagaGenerator<any, any> {
  const seenMsgs: MsgMap = yield select((state: TypedState) => state.gregor.seenMsgs)

  // Check if any are a tlf items
  // $FlowIssue
  const tlfUpdates = items.filter(isTlfItem)
  const newTlfUpdates = tlfUpdates.filter(gItem => !seenMsgs[gItem.md.msgID.toString('base64')])
  if (newTlfUpdates.length) {
    yield put(updateSeenMsgs(newTlfUpdates))
    yield put(favoriteList())
  }
}

function * handlePushState (pushAction: PushState): SagaGenerator<any, any> {
  if (!pushAction.error) {
    const {payload: {state}} = pushAction
    const nonNullItems = toNonNullGregorItems(state)
    if (nonNullItems.length !== (state.items || []).length) {
      console.warn('Lost some messages in filtering out nonNull gregor items')
    }

    yield call(handleTLFUpdate, nonNullItems)
  } else {
    console.log('Error in gregor pushState', pushAction.payload)
  }
}

function * handleKbfsFavoritesOOBM (kbfsFavoriteMessages: Array<OutOfBandMessage>) {
  const msgsWithParsedBodies = kbfsFavoriteMessages.map(m => ({...m, body: JSON.parse(m.body.toString())}))
  const createdTLFs = msgsWithParsedBodies.filter(m => m.body.action === 'create')

  const username: string = ((yield select(usernameSelector)): any)
  yield createdTLFs.map(m => {
    const folder = m.body.tlf ? markTLFCreated(folderFromPath(username, m.body.tlf)) : null
    if (folder != null) {
      return put(folder)
    }
    console.warn('Failed to parse tlf for oobm:', m)
  }).filter(i => !!i)
}

function * handlePushOOBM (pushOOBM: pushOOBM) {
  if (!pushOOBM.error) {
    const {payload: {messages}} = pushOOBM
    yield call(handleKbfsFavoritesOOBM, messages.filter(i => i.system === 'kbfs.favorites'))
  } else {
    console.log('Error in gregor oobm', pushOOBM.payload)
  }
}

function * handleCheckReachability (): SagaGenerator<any, any> {
  const reachability = yield call(reachabilityCheckReachabilityRpcPromise)
  yield put({type: Constants.updateReachability, payload: {reachability}})
}

function * gregorSaga (): SagaGenerator<any, any> {
  yield safeTakeEvery(Constants.pushState, handlePushState)
  yield safeTakeEvery(Constants.pushOOBM, handlePushOOBM)
  yield safeTakeLatest(Constants.checkReachability, handleCheckReachability)
}

export {
  checkReachability,
  checkReachabilityOnConnect,
  pushState,
  registerGregorListeners,
  registerReachability,
  listenForNativeReachabilityEvents,
}

export default gregorSaga
