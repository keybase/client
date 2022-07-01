import logger from '../logger'
import * as ConfigGen from './config-gen'
import * as GregorGen from './gregor-gen'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'

const pushOutOfBandMessages = (action: EngineGen.Keybase1GregorUIPushOutOfBandMessagesPayload) => {
  const {oobm} = action.payload.params
  const filteredOOBM = (oobm || []).filter(Boolean)
  if (filteredOOBM.length) {
    return GregorGen.createPushOOBM({messages: filteredOOBM})
  }
  return false
}

const pushState = (action: EngineGen.Keybase1GregorUIPushStatePayload) => {
  const {reason, state} = action.payload.params
  const items = state.items || []

  const goodState = items.reduce<Array<{item: RPCTypes.Gregor1.Item; md: RPCTypes.Gregor1.Metadata}>>(
    (arr, {md, item}) => {
      md && item && arr.push({item, md})
      return arr
    },
    []
  )

  if (goodState.length !== items.length) {
    logger.warn('Lost some messages in filtering out nonNull gregor items')
  }
  return GregorGen.createPushState({reason, state: goodState})
}

// Gregor reachability is only valid if we're logged in
const reachabilityChanged = (
  state: Container.TypedState,
  action: EngineGen.Keybase1ReachabilityReachabilityChangedPayload
) =>
  state.config.loggedIn &&
  GregorGen.createUpdateReachable({reachable: action.payload.params.reachability.reachable})

// If ever you want to get OOBMs for a different system, then you need to enter it here.
const registerForGregorNotifications = async () => {
  try {
    await RPCTypes.delegateUiCtlRegisterGregorFirehoseFilteredRpcPromise({systems: []})
    logger.info('Registered gregor listener')
  } catch (error) {
    logger.warn('error in registering gregor listener: ', error)
  }
}

// The startReachability RPC call both starts and returns the current
// reachability state. Then we'll get updates of changes from this state via reachabilityChanged.
// This should be run on app start and service re-connect in case the service somehow crashed or was restarted manually.
const startReachability = async () => {
  try {
    const reachability = await RPCTypes.reachabilityStartReachabilityRpcPromise()
    return GregorGen.createUpdateReachable({reachable: reachability.reachable})
  } catch (err) {
    logger.warn('error bootstrapping reachability: ', err)
    return false
  }
}

let _lastOnline: undefined | boolean
const checkReachability = async (
  action: GregorGen.CheckReachabilityPayload | ConfigGen.OsNetworkStatusChangedPayload
) => {
  try {
    if (action.type === ConfigGen.osNetworkStatusChanged) {
      if (action.payload.online === _lastOnline) {
        return false
      }
      _lastOnline = action.payload.online
    }

    const reachability = await RPCTypes.reachabilityCheckReachabilityRpcPromise()
    return GregorGen.createUpdateReachable({reachable: reachability.reachable})
  } catch (_) {
    return false
  }
}

const updateCategory = async (action: GregorGen.UpdateCategoryPayload) => {
  try {
    await RPCTypes.gregorUpdateCategoryRpcPromise({
      body: action.payload.body,
      category: action.payload.category,
      dtime: action.payload.dtime || {offset: 0, time: 0},
    })
  } catch (_) {}
}

function* gregorSaga() {
  yield* Saga.chainAction(GregorGen.updateCategory, updateCategory)
  yield* Saga.chainAction([GregorGen.checkReachability, ConfigGen.osNetworkStatusChanged], checkReachability)
  yield* Saga.chainAction2(EngineGen.connected, registerForGregorNotifications)
  yield* Saga.chainAction2(EngineGen.connected, startReachability)
  yield* Saga.chainAction(EngineGen.keybase1GregorUIPushOutOfBandMessages, pushOutOfBandMessages)
  yield* Saga.chainAction(EngineGen.keybase1GregorUIPushState, pushState)
  yield* Saga.chainAction2(EngineGen.keybase1ReachabilityReachabilityChanged, reachabilityChanged)
}

export default gregorSaga
