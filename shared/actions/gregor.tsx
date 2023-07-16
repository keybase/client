import logger from '../logger'
import * as ConfigConstants from '../constants/config'
import * as GregorGen from './gregor-gen'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import * as Z from '../util/zustand'

const pushOutOfBandMessages = (
  _: unknown,
  action: EngineGen.Keybase1GregorUIPushOutOfBandMessagesPayload
) => {
  const {oobm} = action.payload.params
  const filteredOOBM = (oobm || []).filter(Boolean)
  if (filteredOOBM.length) {
    return GregorGen.createPushOOBM({messages: filteredOOBM})
  }
  return false
}

const pushState = (_: unknown, action: EngineGen.Keybase1GregorUIPushStatePayload) => {
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
const reachabilityChanged = (_: unknown, action: EngineGen.Keybase1ReachabilityReachabilityChangedPayload) =>
  ConfigConstants.useConfigState.getState().loggedIn &&
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

const checkReachability = () => {
  const f = async () => {
    const reduxDispatch = Z.getReduxDispatch()
    try {
      const reachability = await RPCTypes.reachabilityCheckReachabilityRpcPromise()
      reduxDispatch(GregorGen.createUpdateReachable({reachable: reachability.reachable}))
    } catch (_) {}
  }
  Z.ignorePromise(f())
}

const updateCategory = async (_: unknown, action: GregorGen.UpdateCategoryPayload) => {
  try {
    await RPCTypes.gregorUpdateCategoryRpcPromise({
      body: action.payload.body,
      category: action.payload.category,
      dtime: action.payload.dtime || {offset: 0, time: 0},
    })
  } catch (_) {}
}

const initGregor = () => {
  Container.listenAction(GregorGen.updateCategory, updateCategory)
  Container.listenAction(GregorGen.checkReachability, checkReachability)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.networkStatus === old.networkStatus) return
    checkReachability()
  })

  Container.listenAction(EngineGen.connected, registerForGregorNotifications)
  Container.listenAction(EngineGen.connected, startReachability)
  Container.listenAction(EngineGen.keybase1GregorUIPushOutOfBandMessages, pushOutOfBandMessages)
  Container.listenAction(EngineGen.keybase1GregorUIPushState, pushState)
  Container.listenAction(EngineGen.keybase1ReachabilityReachabilityChanged, reachabilityChanged)
}

export default initGregor
