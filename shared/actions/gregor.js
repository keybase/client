// @flow
import logger from '../logger'
import * as ConfigGen from './config-gen'
import * as Types from '../constants/types/gregor'
import * as FavoriteGen from './favorite-gen'
import * as GitGen from './git-gen'
import * as GregorGen from './gregor-gen'
import * as TeamsGen from './teams-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import engine from '../engine'
import {folderFromPath} from '../constants/favorite.js'
import {nativeReachabilityEvents} from '../util/reachability'
import {type Dispatch} from '../constants/types/flux'
import {type State as GregorState, type OutOfBandMessage} from '../constants/types/rpc-gregor-gen'
import {type TypedState} from '../constants/reducer'
import {usernameSelector, loggedInSelector} from '../constants/selectors'
import {isMobile} from '../constants/platform'

function isTlfItem(gItem: Types.NonNullGregorItem): boolean {
  return !!(gItem && gItem.item && gItem.item.category && gItem.item.category === 'tlf')
}

function toNonNullGregorItems(state: GregorState): Array<Types.NonNullGregorItem> {
  return (state.items || []).reduce((arr, x) => {
    const {md, item} = x
    if (md && item) {
      arr.push({item, md})
    }
    return arr
  }, [])
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
        logger.warn('error bootstrapping reachability: ', err)
      })
  }
}

function registerGregorListeners() {
  return (dispatch: Dispatch) => {
    RPCTypes.delegateUiCtlRegisterGregorFirehoseRpcPromise()
      .then(response => {
        logger.info('Registered gregor listener')
      })
      .catch(error => {
        logger.warn('error in registering gregor listener: ', error)
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

function* handleTLFUpdate(items: Array<Types.NonNullGregorItem>): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const seenMsgs: Types.MsgMap = state.gregor.seenMsgs

  // Check if any are a tlf items
  const tlfUpdates = items.filter(isTlfItem)
  const newTlfUpdates = tlfUpdates.filter(gItem => !seenMsgs[gItem.md.msgID.toString('base64')])
  if (newTlfUpdates.length) {
    yield Saga.put(GregorGen.createUpdateSeenMsgs({seenMsgs: newTlfUpdates}))
    // We can ignore these on mobile, we don't have a menu widget, etc
    if (!isMobile) {
      yield Saga.put(FavoriteGen.createFavoriteList())
    }
  }
}

function* handleIntroBanners(items: Array<Types.NonNullGregorItem>): Saga.SagaGenerator<any, any> {
  const sawChatBanner = items.find(i => i.item && i.item.category === 'sawChatBanner')
  const sawSubteamsBanner = items.find(i => i.item && i.item.category === 'sawSubteamsBanner')
  if (sawChatBanner) {
    yield Saga.put(TeamsGen.createSetTeamSawChatBanner())
  }
  if (sawSubteamsBanner) {
    yield Saga.put(TeamsGen.createSetTeamSawSubteamsBanner())
  }
}

function _handlePushState(pushAction: GregorGen.PushStatePayload) {
  if (!pushAction.error) {
    const {payload: {state}} = pushAction
    const nonNullItems = toNonNullGregorItems(state)
    if (nonNullItems.length !== (state.items || []).length) {
      logger.warn('Lost some messages in filtering out nonNull gregor items')
    }

    return Saga.sequentially([
      Saga.call(handleTLFUpdate, nonNullItems),
      Saga.call(handleIntroBanners, nonNullItems),
    ])
  } else {
    logger.debug('Error in gregor pushState', pushAction.payload)
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
    logger.warn('Failed to parse tlf for oobm:')
    logger.debug('Failed to parse tlf for oobm:', m)
    return arr
  }, [])
  yield Saga.all(folderActions)
}

function _handlePushOOBM(pushOOBM: GregorGen.PushOOBMPayload) {
  const actions = []
  if (!pushOOBM.error) {
    const {payload: {messages}} = pushOOBM

    // Filter first so we don't dispatch unnecessary actions
    const gitMessages = messages.filter(i => i.system === 'git')
    if (gitMessages.length > 0) {
      actions.push(Saga.put(GitGen.createHandleIncomingGregor({messages: gitMessages})))
    }

    actions.push(Saga.call(handleKbfsFavoritesOOBM, messages.filter(i => i.system === 'kbfs.favorites')))
  } else {
    logger.debug('Error in gregor oobm', pushOOBM.payload)
  }

  return Saga.sequentially(actions)
}

const _handleCheckReachability = (action: GregorGen.CheckReachabilityPayload) =>
  Saga.call(RPCTypes.reachabilityCheckReachabilityRpcPromise)

const _handleCheckReachabilitySuccess = reachability =>
  Saga.put(GregorGen.createUpdateReachability({reachability}))

function _injectItem(action: GregorGen.InjectItemPayload) {
  const {category, body, dtime} = action.payload
  return Saga.call(RPCTypes.gregorInjectItemRpcPromise, {
    body,
    cat: category,
    dtime: {
      time: dtime || 0,
      offset: 0,
    },
  })
}

function* gregorSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(GregorGen.pushState, _handlePushState)
  yield Saga.safeTakeEveryPure(GregorGen.pushOOBM, _handlePushOOBM)
  yield Saga.safeTakeEveryPure(GregorGen.injectItem, _injectItem)
  yield Saga.safeTakeLatestPure(
    GregorGen.checkReachability,
    _handleCheckReachability,
    _handleCheckReachabilitySuccess
  )
}

export {
  checkReachabilityOnConnect,
  registerGregorListeners,
  registerReachability,
  listenForNativeReachabilityEvents,
}

export default gregorSaga
