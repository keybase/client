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
import * as Platform from '../../constants/platform'
import {RPCError} from '../../util/errors'
import KB2 from '../../util/electron'

const {darwinCopyToKBFSTempUploadFile} = KB2.functions

const clientID = Constants.clientID

const setSpaceNotificationThreshold = async (
  _: unknown,
  action: FsGen.SetSpaceAvailableNotificationThresholdPayload
) => {
  await RPCTypes.SimpleFSSimpleFSSetNotificationThresholdRpcPromise({
    threshold: action.payload.spaceAvailableNotificationThreshold,
  })
  Constants.useState.getState().dispatch.loadSettings()
}

const cancelDownload = async (_: unknown, action: FsGen.CancelDownloadPayload) =>
  RPCTypes.SimpleFSSimpleFSCancelDownloadRpcPromise({downloadID: action.payload.downloadID})

const dismissDownload = async (_: unknown, action: FsGen.DismissDownloadPayload) =>
  RPCTypes.SimpleFSSimpleFSDismissDownloadRpcPromise({downloadID: action.payload.downloadID})

const dismissUpload = async (_: Container.TypedState, action: FsGen.DismissUploadPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSDismissUploadRpcPromise({uploadID: action.payload.uploadID})
  } catch {}
  return false
}

const letResetUserBackIn = async (_: unknown, action: FsGen.LetResetUserBackInPayload) => {
  try {
    await RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise({
      id: action.payload.id,
      username: action.payload.username,
    })
  } catch (error) {
    Constants.errorToActionOrThrow(error)
    return
  }
  return
}

const deleteFile = async (_: unknown, action: FsGen.DeleteFilePayload) => {
  const opID = Constants.makeUUID()
  try {
    await RPCTypes.SimpleFSSimpleFSRemoveRpcPromise({
      opID,
      path: Constants.pathToRPCPath(action.payload.path),
      recursive: true,
    })
    await RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID})
  } catch (e) {
    Constants.errorToActionOrThrow(e, action.payload.path)
    return
  }
  return
}

const moveOrCopy = async (_: unknown, action: FsGen.MovePayload | FsGen.CopyPayload) => {
  const zState = Constants.useState.getState()
  if (zState.destinationPicker.source.type === Types.DestinationPickerSource.None) {
    return
  }

  const params =
    zState.destinationPicker.source.type === Types.DestinationPickerSource.MoveOrCopy
      ? [
          {
            dest: Constants.pathToRPCPath(
              Types.pathConcat(
                action.payload.destinationParentPath,
                Types.getPathName(zState.destinationPicker.source.path)
              )
            ),
            opID: Constants.makeUUID(),
            overwriteExistingFiles: false,
            src: Constants.pathToRPCPath(zState.destinationPicker.source.path),
          },
        ]
      : zState.destinationPicker.source.source
          .map(item => ({originalPath: item.originalPath ?? '', scaledPath: item.scaledPath}))
          .filter(({originalPath}) => !!originalPath)
          .map(({originalPath, scaledPath}) => ({
            dest: Constants.pathToRPCPath(
              Types.pathConcat(
                action.payload.destinationParentPath,
                Types.getLocalPathName(originalPath)
                // We use the local path name here since we only care about file name.
              )
            ),
            opID: Constants.makeUUID(),
            overwriteExistingFiles: false,
            src: {
              PathType: RPCTypes.PathType.local,
              local: Types.getNormalizedLocalPath(
                ConfigConstants.useConfigState.getState().incomingShareUseOriginal
                  ? originalPath
                  : scaledPath || originalPath
              ),
            } as RPCTypes.Path,
          }))

  try {
    const rpc =
      action.type === FsGen.move
        ? RPCTypes.SimpleFSSimpleFSMoveRpcPromise
        : RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise
    await Promise.all(params.map(async p => rpc(p)))
    await Promise.all(params.map(async ({opID}) => RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID})))
    return null
    // We get source/dest paths from state rather than action, so we can't
    // just retry it. If we do want retry in the future we can include those
    // paths in the action.
  } catch (e) {
    Constants.errorToActionOrThrow(e, action.payload.destinationParentPath)
    return
  }
}

const startManualCR = async (_: unknown, action: FsGen.StartManualConflictResolutionPayload) => {
  await RPCTypes.SimpleFSSimpleFSClearConflictStateRpcPromise({
    path: Constants.pathToRPCPath(action.payload.tlfPath),
  })

  Constants.useState.getState().dispatch.favoritesLoad()
}

const finishManualCR = async (_: unknown, action: FsGen.FinishManualConflictResolutionPayload) => {
  await RPCTypes.SimpleFSSimpleFSFinishResolvingConflictRpcPromise({
    path: Constants.pathToRPCPath(action.payload.localViewTlfPath),
  })
  Constants.useState.getState().dispatch.favoritesLoad()
}

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

const setTlfsAsUnloadedWhenKbfsDaemonDisconnects = () => {
  const kbfsDaemonStatus = Constants.useState.getState().kbfsDaemonStatus
  if (kbfsDaemonStatus.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected) {
    Constants.useState.getState().dispatch.setTlfsAsUnloaded()
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
      return FsGen.createLoadDownloadStatus()
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

const loadPathInfo = async (_: unknown, action: FsGen.LoadPathInfoPayload) => {
  const pathInfo = await RPCTypes.kbfsMountGetKBFSPathInfoRpcPromise({
    standardPath: Types.pathToString(action.payload.path),
  })
  return FsGen.createLoadedPathInfo({
    path: action.payload.path,
    pathInfo: {
      deeplinkPath: pathInfo.deeplinkPath,
      platformAfterMountPath: pathInfo.platformAfterMountPath,
    },
  })
}

const loadDownloadInfo = async (_: Container.TypedState, action: FsGen.LoadDownloadInfoPayload) => {
  try {
    const res = await RPCTypes.SimpleFSSimpleFSGetDownloadInfoRpcPromise({
      downloadID: action.payload.downloadID,
    })
    Constants.useState.getState().dispatch.loadedDownloadInfo(action.payload.downloadID, {
      filename: res.filename,
      isRegularDownload: res.isRegularDownload,
      path: Types.stringToPath('/keybase' + res.path.path),
      startTime: res.startTime,
    })
    return
  } catch (error) {
    Constants.errorToActionOrThrow(error)
    return
  }
}

const loadDownloadStatus = async () => {
  try {
    const res = await RPCTypes.SimpleFSSimpleFSGetDownloadStatusRpcPromise()
    Constants.useState.getState().dispatch.loadedDownloadStatus(
      res.regularDownloadIDs || [],
      new Map(
        (res.states || []).map(s => [
          s.downloadID,
          {
            canceled: s.canceled,
            done: s.done,
            endEstimate: s.endEstimate,
            error: s.error,
            localPath: s.localPath,
            progress: s.progress,
          },
        ])
      )
    )
    return
  } catch (error) {
    Constants.errorToActionOrThrow(error)
    return
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

let fsBadgeSubscriptionID: string = ''

const subscribeAndLoadFsBadge = () => {
  const oldFsBadgeSubscriptionID = fsBadgeSubscriptionID
  fsBadgeSubscriptionID = Constants.makeUUID()
  const kbfsDaemonStatus = Constants.useState.getState().kbfsDaemonStatus
  if (kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) {
    if (oldFsBadgeSubscriptionID) {
      Constants.useState.getState().dispatch.unsubscribe(oldFsBadgeSubscriptionID)
    }
    Constants.useState
      .getState()
      .dispatch.subscribeNonPath(fsBadgeSubscriptionID, RPCTypes.SubscriptionTopic.filesTabBadge)
    return FsGen.createLoadFilesTabBadge()
  } else {
    return
  }
}

let uploadStatusSubscriptionID: string = ''
const subscribeAndLoadUploadStatus = () => {
  const oldUploadStatusSubscriptionID = uploadStatusSubscriptionID
  uploadStatusSubscriptionID = Constants.makeUUID()
  const kbfsDaemonStatus = Constants.useState.getState().kbfsDaemonStatus

  if (kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) {
    Constants.useState.getState().dispatch.loadUploadStatus()
  }

  if (kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) {
    if (oldUploadStatusSubscriptionID) {
      Constants.useState.getState().dispatch.unsubscribe(oldUploadStatusSubscriptionID)
    }

    Constants.useState
      .getState()
      .dispatch.subscribeNonPath(uploadStatusSubscriptionID, RPCTypes.SubscriptionTopic.uploadStatus)
  }
}

let journalStatusSubscriptionID: string = ''
const subscribeAndLoadJournalStatus = () => {
  const oldJournalStatusSubscriptionID = journalStatusSubscriptionID
  journalStatusSubscriptionID = Constants.makeUUID()
  const kbfsDaemonStatus = Constants.useState.getState().kbfsDaemonStatus
  if (kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) {
    if (oldJournalStatusSubscriptionID) {
      Constants.useState.getState().dispatch.unsubscribe(oldJournalStatusSubscriptionID)
    }
    Constants.useState
      .getState()
      .dispatch.subscribeNonPath(journalStatusSubscriptionID, RPCTypes.SubscriptionTopic.journalStatus)
    Constants.useState.getState().dispatch.pollJournalStatus()
  }
}

let settingsSubscriptionID: string = ''
const subscribeAndLoadSettings = () => {
  const oldSettingsSubscriptionID = settingsSubscriptionID
  settingsSubscriptionID = Constants.makeUUID()
  const kbfsDaemonStatus = Constants.useState.getState().kbfsDaemonStatus
  if (kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) {
    Constants.useState.getState().dispatch.loadSettings()
  }

  if (kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) {
    if (oldSettingsSubscriptionID) {
      Constants.useState.getState().dispatch.unsubscribe(oldSettingsSubscriptionID)
    }
    Constants.useState
      .getState()
      .dispatch.subscribeNonPath(settingsSubscriptionID, RPCTypes.SubscriptionTopic.settings)
  }
}

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
  Container.listenAction(FsGen.uploadFromDragAndDrop, async (_, action) => {
    if (Platform.isDarwin && darwinCopyToKBFSTempUploadFile) {
      const dir = await RPCTypes.SimpleFSSimpleFSMakeTempDirForUploadRpcPromise()
      const localPaths = await Promise.all(
        action.payload.localPaths.map(async localPath => darwinCopyToKBFSTempUploadFile(dir, localPath))
      )
      localPaths.forEach(localPath =>
        Constants.useState.getState().dispatch.upload(action.payload.parentPath, localPath)
      )
    } else {
      action.payload.localPaths.forEach(localPath =>
        Constants.useState.getState().dispatch.upload(action.payload.parentPath, localPath)
      )
    }
  })
  Container.listenAction(FsGen.dismissUpload, dismissUpload)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, setTlfsAsUnloadedWhenKbfsDaemonDisconnects)
  Container.listenAction(FsGen.letResetUserBackIn, letResetUserBackIn)
  Container.listenAction(FsGen.deleteFile, deleteFile)
  Container.listenAction([FsGen.move, FsGen.copy], moveOrCopy)
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
  Container.listenAction(FsGen.setSpaceAvailableNotificationThreshold, setSpaceNotificationThreshold)
  Container.listenAction(FsGen.startManualConflictResolution, startManualCR)
  Container.listenAction(FsGen.finishManualConflictResolution, finishManualCR)
  Container.listenAction(FsGen.loadPathInfo, loadPathInfo)
  Container.listenAction(FsGen.loadFilesTabBadge, loadFilesTabBadge)

  Container.listenAction(FsGen.cancelDownload, cancelDownload)
  Container.listenAction(FsGen.dismissDownload, dismissDownload)
  Container.listenAction(FsGen.loadDownloadStatus, loadDownloadStatus)
  Container.listenAction(FsGen.loadDownloadInfo, loadDownloadInfo)

  Container.listenAction(EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath, onPathChange)
  Container.listenAction(EngineGen.keybase1NotifyFSFSSubscriptionNotify, onNonPathChange)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, subscribeAndLoadFsBadge)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, subscribeAndLoadSettings)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, subscribeAndLoadUploadStatus)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, subscribeAndLoadJournalStatus)

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
