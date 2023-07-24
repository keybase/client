import * as Constants from '../../constants/fs'
import * as ConfigConstants from '../../constants/config'
import * as RouterConstants from '../../constants/router2'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Tabs from '../../constants/tabs'
import * as Z from '../../util/zustand'
import logger from '../../logger'
import initPlatformSpecific from './platform-specific'
import {RPCError} from '../../util/errors'

const fsRrouteNames = ['fsRoot', 'barePreview']

const initFS = () => {
  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    if (ConfigConstants.useConfigState.getState().loggedIn) {
      Constants.useState.getState().dispatch.checkKbfsDaemonRpcStatus()
    }
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.installerRanCount !== old.installerRanCount) {
      Constants.useState.getState().dispatch.checkKbfsDaemonRpcStatus()
    }
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.networkStatus === old.networkStatus) return
    // We don't trigger the reachability check at init. Reachability checks cause
    // any pending "reconnect" fire right away, and overrides any random back-off
    // timer we have at process restart (which is there to avoid surging server
    // load around app releases). So only do that when OS network status changes
    // after we're up.
    const isInit = s.networkStatus?.isInit
    const f = async () => {
      if (!isInit) {
        try {
          await RPCTypes.SimpleFSSimpleFSCheckReachabilityRpcPromise()
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn(`failed to check KBFS reachability: ${error.message}`)
        }
      }
    }
    Z.ignorePromise(f())
  })

  RouterConstants.useState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return

    const {criticalUpdate} = Constants.useState.getState()
    // Clear critical update when we nav away from tab
    if (
      criticalUpdate &&
      prev &&
      RouterConstants.getTab(prev) === Tabs.fsTab &&
      next &&
      RouterConstants.getTab(next) !== Tabs.fsTab
    ) {
      Constants.useState.getState().dispatch.setCriticalUpdate(false)
    }

    const wasScreen = fsRrouteNames.includes(RouterConstants.getVisibleScreen(prev)?.name ?? '')
    const isScreen = fsRrouteNames.includes(RouterConstants.getVisibleScreen(next)?.name ?? '')
    if (wasScreen !== isScreen) {
      if (wasScreen) {
        Constants.useState.getState().dispatch.userOut()
      } else {
        Constants.useState.getState().dispatch.userIn()
      }
    }
  })

  initPlatformSpecific()
}

export default initFS
