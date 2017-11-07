// @flow
import * as ConfigGen from './config-gen'
import * as Constants from '../constants/gregor'
import * as GitGen from './git-gen'
import * as GregorGen from './gregor-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import engine from '../engine'
import {all, call, put, select} from 'redux-saga/effects'
import {clearErrors} from '../util/pictures'
import {favoriteList, markTLFCreated} from './favorite'
import {folderFromPath} from '../constants/favorite.js'
import {nativeReachabilityEvents} from '../util/reachability'
import {replaceEntity} from './entities'
import {safeTakeEvery, safeTakeLatest} from '../util/saga'
import {type Dispatch} from '../constants/types/flux'
import {type SagaGenerator} from '../constants/types/saga'
import {type State as GregorState, type OutOfBandMessage} from '../constants/types/flow-types-gregor'
import {type TypedState} from '../constants/reducer'
import {usernameSelector, loggedInSelector} from '../constants/selectors'

function pushOOBM(messages: Array<OutOfBandMessage>): Constants.PushOOBM {
  return {type: Constants.pushOOBM, payload: {messages}}
}

function updateReachability(reachability: RPCTypes.Reachability): Constants.UpdateReachability {
  return {type: Constants.updateReachability, payload: {reachability}}
}

function checkReachability(): Constants.CheckReachability {
  return {type: Constants.checkReachability, payload: undefined}
}

function updateSeenMsgs(seenMsgs: Array<Constants.NonNullGregorItem>): Constants.UpdateSeenMsgs {
  return {type: Constants.updateSeenMsgs, payload: {seenMsgs}}
}

function injectItem(category: string, body: string, dtime?: ?Date): Constants.InjectItem {
  return {type: Constants.injectItem, payload: {category, body, dtime}}
}

function isTlfItem(gItem: Constants.NonNullGregorItem): boolean {
  return !!(gItem && gItem.item && gItem.item.category && gItem.item.category === 'tlf')
}

function toNonNullGregorItems(state: GregorState): Array<Constants.NonNullGregorItem> {
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
        dispatch(updateReachability(reachability))

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
        dispatch(updateReachability(reachability))
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
          dispatch(pushOOBM(filteredOOBM))
        }
      }
      response && response.result()
    })
  }
}

function* handleTLFUpdate(items: Array<Constants.NonNullGregorItem>): SagaGenerator<any, any> {
  const seenMsgs: Constants.MsgMap = yield select((state: TypedState) => state.gregor.seenMsgs)

  // Check if any are a tlf items
  const tlfUpdates = items.filter(isTlfItem)
  const newTlfUpdates = tlfUpdates.filter(gItem => !seenMsgs[gItem.md.msgID.toString('base64')])
  if (newTlfUpdates.length) {
    yield put(updateSeenMsgs(newTlfUpdates))
    yield put(favoriteList())
  }
}

function* handleChatBanner(items: Array<Constants.NonNullGregorItem>): SagaGenerator<any, any> {
  const sawChatBanner = items.find(i => i.item && i.item.category === 'sawChatBanner')
  if (sawChatBanner) {
    // TODO move this to teams eventually
    yield put(replaceEntity(['teams'], I.Map([['sawChatBanner', true]])))
  }
}

function* handlePushState(pushAction: GregorGen.PushStatePayload): SagaGenerator<any, any> {
  if (!pushAction.error) {
    const {payload: {state}} = pushAction
    const nonNullItems = toNonNullGregorItems(state)
    if (nonNullItems.length !== (state.items || []).length) {
      console.warn('Lost some messages in filtering out nonNull gregor items')
    }

    yield call(handleTLFUpdate, nonNullItems)
    yield call(handleChatBanner, nonNullItems)
  } else {
    console.log('Error in gregor pushState', pushAction.payload)
  }
}

function* handleKbfsFavoritesOOBM(kbfsFavoriteMessages: Array<OutOfBandMessage>): Generator<any, void, any> {
  const msgsWithParsedBodies = kbfsFavoriteMessages.map(m => ({...m, body: JSON.parse(m.body.toString())}))
  const createdTLFs = msgsWithParsedBodies.filter(m => m.body.action === 'create')

  const username: string = (yield select(usernameSelector): any)
  const folderActions = createdTLFs.reduce((arr, m) => {
    const folder = m.body.tlf ? markTLFCreated(folderFromPath(username, m.body.tlf)) : null
    if (folder && folder.payload && folder.payload.folder) {
      arr.push(put(folder))
      return arr
    }
    console.warn('Failed to parse tlf for oobm:', m)
    return arr
  }, [])
  yield all(folderActions)
}

function* handlePushOOBM(pushOOBM: Constants.PushOOBM) {
  if (!pushOOBM.error) {
    const {payload: {messages}} = pushOOBM

    // Filter first so we don't dispatch unnecessary actions
    const gitMessages = messages.filter(i => i.system === 'git')
    if (gitMessages.length > 0) {
      yield put(GitGen.createHandleIncomingGregor({messages: gitMessages}))
    }

    yield call(handleKbfsFavoritesOOBM, messages.filter(i => i.system === 'kbfs.favorites'))
  } else {
    console.log('Error in gregor oobm', pushOOBM.payload)
  }
}

function* handleCheckReachability(): SagaGenerator<any, any> {
  const reachability = yield call(RPCTypes.reachabilityCheckReachabilityRpcPromise)
  yield put({type: Constants.updateReachability, payload: {reachability}})
}

function* _injectItem(action: Constants.InjectItem): SagaGenerator<any, any> {
  const {category, body, dtime} = action.payload
  yield call(RPCTypes.gregorInjectItemRpcPromise, {
    param: {
      body,
      cat: category,
      dtime: {
        time: dtime || 0,
        offset: 0,
      },
    },
  })
}

function* gregorSaga(): SagaGenerator<any, any> {
  yield safeTakeEvery(GregorGen.pushState, handlePushState)
  yield safeTakeEvery(Constants.pushOOBM, handlePushOOBM)
  yield safeTakeEvery(Constants.injectItem, _injectItem)
  yield safeTakeLatest(Constants.checkReachability, handleCheckReachability)
}

export {
  checkReachability,
  checkReachabilityOnConnect,
  registerGregorListeners,
  registerReachability,
  listenForNativeReachabilityEvents,
  injectItem,
}

export default gregorSaga
