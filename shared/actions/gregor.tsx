import * as ConfigConstants from '../constants/config'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import * as Z from '../util/zustand'

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
  Container.listenAction(EngineGen.keybase1ReachabilityReachabilityChanged, reachabilityChanged)
}

export default initGregor
