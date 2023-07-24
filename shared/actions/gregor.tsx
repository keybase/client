import * as ConfigConstants from '../constants/config'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Z from '../util/zustand'

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
}

export default initGregor
