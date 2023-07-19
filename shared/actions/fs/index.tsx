import * as Constants from '../../constants/fs'
import * as ConfigConstants from '../../constants/config'
import * as Router2Constants from '../../constants/router2'
import * as EngineGen from '../engine-gen-gen'
import * as FsGen from '../fs-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Tabs from '../../constants/tabs'
import * as Types from '../../constants/types/fs'
import * as Container from '../../util/container'
import * as Z from '../../util/zustand'
import logger from '../../logger'
import initPlatformSpecific from './platform-specific'
import * as RouteTreeGen from '../route-tree-gen'
import {RPCError} from '../../util/errors'

const clientID = Constants.clientID

// At start-up we might have a race where we get connected to a kbfs daemon
// which dies soon after, and we get an EOF here. So retry for a few times
// until we get through. After each try we delay for 2s, so this should give us
// e.g. 12s when n == 6. If it still doesn't work after 12s, something's wrong
// and we deserve a black bar.
const checkIfWeReConnectedToMDServerUpToNTimes = async (n: number): Promise<void> => {
  try {
    const onlineStatus = await RPCTypes.SimpleFSSimpleFSGetOnlineStatusRpcPromise({clientID})
    Constants.useState.getState().dispatch.kbfsDaemonOnlineStatusChanged(onlineStatus)
    return
  } catch (error) {
    if (n > 0) {
      logger.warn(`failed to check if we are connected to MDServer: ${error}; n=${n}`)
      await Container.timeoutPromise(2000)
      return checkIfWeReConnectedToMDServerUpToNTimes(n - 1)
    } else {
      logger.warn(`failed to check if we are connected to MDServer : ${error}; n=${n}, throwing`)
      throw error
    }
  }
}

const setDebugLevel = async (_: unknown, action: FsGen.SetDebugLevelPayload) =>
  RPCTypes.SimpleFSSimpleFSSetDebugLevelRpcPromise({level: action.payload.level})

const onPathChange = (_: unknown, action: EngineGen.Keybase1NotifyFSFSSubscriptionNotifyPathPayload) => {
  const {clientID: clientIDFromNotification, path, topics} = action.payload.params
  if (clientIDFromNotification !== clientID) {
    return
  }

  const {folderListLoad} = Constants.useState.getState().dispatch
  topics?.forEach(topic => {
    switch (topic) {
      case RPCTypes.PathSubscriptionTopic.children:
        folderListLoad(Types.stringToPath(path), false)
        break
      case RPCTypes.PathSubscriptionTopic.stat:
        Constants.useState.getState().dispatch.loadPathMetadata(Types.stringToPath(path))
        break
    }
  })
}

const onNonPathChange = async (_: unknown, action: EngineGen.Keybase1NotifyFSFSSubscriptionNotifyPayload) => {
  const {clientID: clientIDFromNotification, topic} = action.payload.params
  if (clientIDFromNotification !== clientID) {
    return null
  }
  switch (topic) {
    case RPCTypes.SubscriptionTopic.favorites:
      Constants.useState.getState().dispatch.favoritesLoad()
      return
    case RPCTypes.SubscriptionTopic.journalStatus:
      Constants.useState.getState().dispatch.pollJournalStatus()
      return
    case RPCTypes.SubscriptionTopic.onlineStatus:
      return checkIfWeReConnectedToMDServerUpToNTimes(1)
    case RPCTypes.SubscriptionTopic.downloadStatus:
      Constants.useState.getState().dispatch.loadDownloadStatus()
      return
    case RPCTypes.SubscriptionTopic.uploadStatus:
      Constants.useState.getState().dispatch.loadUploadStatus()
      return
    case RPCTypes.SubscriptionTopic.filesTabBadge:
      return FsGen.createLoadFilesTabBadge()
    case RPCTypes.SubscriptionTopic.settings:
      Constants.useState.getState().dispatch.loadSettings()
      return
    case RPCTypes.SubscriptionTopic.overallSyncStatus:
      return undefined
  }
}

const loadFilesTabBadge = async () => {
  try {
    const badge = await RPCTypes.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
    return FsGen.createLoadedFilesTabBadge({badge})
  } catch {
    // retry once HOTPOT-1226
    try {
      const badge = await RPCTypes.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
      return FsGen.createLoadedFilesTabBadge({badge})
    } catch {}
  }
  return false
}

const userIn = async () => RPCTypes.SimpleFSSimpleFSUserInRpcPromise({clientID}).catch(() => {})
const userOut = async () => RPCTypes.SimpleFSSimpleFSUserOutRpcPromise({clientID}).catch(() => {})

const fsRrouteNames = ['fsRoot', 'barePreview']
const maybeOnFSTab = (_: unknown, action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  const wasScreen = fsRrouteNames.includes(Router2Constants.getVisibleScreen(prev)?.name ?? '')
  const isScreen = fsRrouteNames.includes(Router2Constants.getVisibleScreen(next)?.name ?? '')

  if (wasScreen === isScreen) {
    return false
  }
  return wasScreen ? FsGen.createUserOut() : FsGen.createUserIn()
}

const initFS = () => {
  Container.listenAction(FsGen.userIn, () => {
    Constants.useState.getState().dispatch.checkKbfsDaemonRpcStatus()
  })

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
  Container.listenAction(EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged, (_, a) => {
    a.payload.params.status
  })
  Container.listenAction(FsGen.userIn, userIn)
  Container.listenAction(FsGen.userOut, userOut)
  Container.listenAction(FsGen.loadFilesTabBadge, loadFilesTabBadge)

  Container.listenAction(EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath, onPathChange)
  Container.listenAction(EngineGen.keybase1NotifyFSFSSubscriptionNotify, onNonPathChange)

  Container.listenAction(FsGen.setDebugLevel, setDebugLevel)

  Container.listenAction(RouteTreeGen.onNavChanged, (_, action) => {
    const {prev, next} = action.payload
    const {criticalUpdate} = Constants.useState.getState()
    // Clear critical update when we nav away from tab
    if (
      criticalUpdate &&
      prev &&
      Router2Constants.getTab(prev) === Tabs.fsTab &&
      next &&
      Router2Constants.getTab(next) !== Tabs.fsTab
    ) {
      Constants.useState.getState().dispatch.setCriticalUpdate(false)
    }
  })
  Container.listenAction(RouteTreeGen.onNavChanged, maybeOnFSTab)

  initPlatformSpecific()

  Container.listenAction(FsGen.setCriticalUpdate, (_, action) => {
    Constants.useState.getState().dispatch.setCriticalUpdate(action.payload.critical)
  })
}

export default initFS
