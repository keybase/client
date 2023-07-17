import logger from '../logger'
import * as ConfigConstants from '../constants/config'
import * as GregorGen from './gregor-gen'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import * as Z from '../util/zustand'

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
const reachabilityChanged = (
  _: unknown,
  action: EngineGen.Keybase1ReachabilityReachabilityChangedPayload
) => {
  if (ConfigConstants.useConfigState.getState().loggedIn) {
    ConfigConstants.useConfigState
      .getState()
      .dispatch.setGregorReachable(action.payload.params.reachability.reachable)
  }
}

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
    ConfigConstants.useConfigState.getState().dispatch.setGregorReachable(reachability.reachable)
  } catch (err) {
    logger.warn('error bootstrapping reachability: ', err)
  }
}

const checkReachability = () => {
  const f = async () => {
    try {
      const reachability = await RPCTypes.reachabilityCheckReachabilityRpcPromise()
      ConfigConstants.useConfigState.getState().dispatch.setGregorReachable(reachability.reachable)
    } catch (_) {}
  }
  Z.ignorePromise(f())
}

const initGregor = () => {
  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.networkStatus === old.networkStatus) return
    checkReachability()
  })

  Container.listenAction(EngineGen.connected, registerForGregorNotifications)
  Container.listenAction(EngineGen.connected, startReachability)
  Container.listenAction(EngineGen.keybase1GregorUIPushState, pushState)
  Container.listenAction(EngineGen.keybase1ReachabilityReachabilityChanged, reachabilityChanged)
}

export default initGregor
