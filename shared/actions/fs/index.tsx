import * as Constants from '../../constants/fs'
import * as NotifConstants from '../../constants/notifications'
import * as ConfigConstants from '../../constants/config'
import * as Router2Constants from '../../constants/router2'
import * as EngineGen from '../engine-gen-gen'
import * as FsGen from '../fs-gen'
import * as ConfigGen from '../config-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Tabs from '../../constants/tabs'
import * as Types from '../../constants/types/fs'
import * as Container from '../../util/container'
import logger from '../../logger'
import initPlatformSpecific from './platform-specific'
import * as RouteTreeGen from '../route-tree-gen'
import * as Platform from '../../constants/platform'
import {RPCError} from '../../util/errors'
import KB2 from '../../util/electron'
import {requestPermissionsToWrite} from '../platform-specific'

const {darwinCopyToKBFSTempUploadFile} = KB2.functions

const clientID = Constants.makeUUID()

const setTlfSyncConfig = async (_: unknown, action: FsGen.SetTlfSyncConfigPayload) => {
  await RPCTypes.SimpleFSSimpleFSSetFolderSyncConfigRpcPromise(
    {
      config: {
        mode: action.payload.enabled ? RPCTypes.FolderSyncMode.enabled : RPCTypes.FolderSyncMode.disabled,
      },
      path: Constants.pathToRPCPath(action.payload.tlfPath),
    },
    Constants.syncToggleWaitingKey
  )
  Constants.useState.getState().dispatch.loadTlfSyncConfig(action.payload.tlfPath)
}

const setSpaceNotificationThreshold = async (
  _: unknown,
  action: FsGen.SetSpaceAvailableNotificationThresholdPayload
) => {
  await RPCTypes.SimpleFSSimpleFSSetNotificationThresholdRpcPromise({
    threshold: action.payload.spaceAvailableNotificationThreshold,
  })
  Constants.useState.getState().dispatch.loadSettings()
}

const download = async (
  _: unknown,
  action: FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload
) => {
  await requestPermissionsToWrite()
  const downloadID = await RPCTypes.SimpleFSSimpleFSStartDownloadRpcPromise({
    isRegularDownload: action.type === FsGen.download,
    path: Constants.pathToRPCPath(action.payload.path).kbfs,
  })
  const {setPathItemActionMenuDownload} = Constants.useState.getState().dispatch
  if (action.type !== FsGen.download) {
    setPathItemActionMenuDownload(downloadID, Constants.getDownloadIntentFromAction(action))
  }
}

const cancelDownload = async (_: unknown, action: FsGen.CancelDownloadPayload) =>
  RPCTypes.SimpleFSSimpleFSCancelDownloadRpcPromise({downloadID: action.payload.downloadID})

const dismissDownload = async (_: unknown, action: FsGen.DismissDownloadPayload) =>
  RPCTypes.SimpleFSSimpleFSDismissDownloadRpcPromise({downloadID: action.payload.downloadID})

const upload = async (_: Container.TypedState, action: FsGen.UploadPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSStartUploadRpcPromise({
      sourceLocalPath: Types.getNormalizedLocalPath(action.payload.localPath),
      targetParentPath: Constants.pathToRPCPath(action.payload.parentPath).kbfs,
    })
    return false
  } catch (err) {
    Constants.errorToActionOrThrow(err)
    return
  }
}

const uploadFromDragAndDrop = async (_: Container.TypedState, action: FsGen.UploadFromDragAndDropPayload) => {
  if (Platform.isDarwin && darwinCopyToKBFSTempUploadFile) {
    const dir = await RPCTypes.SimpleFSSimpleFSMakeTempDirForUploadRpcPromise()
    const localPaths = await Promise.all(
      action.payload.localPaths.map(async localPath => darwinCopyToKBFSTempUploadFile(dir, localPath))
    )
    return localPaths.map(localPath =>
      FsGen.createUpload({
        localPath,
        parentPath: action.payload.parentPath,
      })
    )
  }
  return action.payload.localPaths.map(localPath =>
    FsGen.createUpload({
      localPath,
      parentPath: action.payload.parentPath,
    })
  )
}

const dismissUpload = async (_: Container.TypedState, action: FsGen.DismissUploadPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSDismissUploadRpcPromise({uploadID: action.payload.uploadID})
  } catch {}
  return false
}

const getWaitDuration = (endEstimate: number | undefined, lower: number, upper: number): number => {
  if (!endEstimate) {
    return upper
  }

  const diff = endEstimate - Date.now()
  return diff < lower ? lower : diff > upper ? upper : diff
}

// TODO: move these logic into Go HOTPOT-533
let polling = false
const pollJournalFlushStatusUntilDone = async (
  _s: unknown,
  _a: unknown,
  listenerApi: Container.ListenerApi
) => {
  if (polling) {
    return
  }
  polling = true
  try {
    // eslint-disable-next-line
    while (1) {
      const {syncingPaths, totalSyncingBytes, endEstimate} =
        await RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise({
          filter: RPCTypes.ListFilter.filterSystemHidden,
        })

      Constants.useState
        .getState()
        .dispatch.journalUpdate(
          (syncingPaths || []).map(Types.stringToPath),
          totalSyncingBytes,
          endEstimate ?? undefined
        )

      // It's possible syncingPaths has not been emptied before
      // totalSyncingBytes becomes 0. So check both.
      if (totalSyncingBytes <= 0 && !syncingPaths?.length) {
        break
      }
      NotifConstants.useState.getState().dispatch.badgeApp('kbfsUploading', true)
      await listenerApi.delay(getWaitDuration(endEstimate || undefined, 100, 4000)) // 0.1s to 4s
    }
  } finally {
    polling = false
    NotifConstants.useState.getState().dispatch.badgeApp('kbfsUploading', false)
    Constants.useState.getState().dispatch.checkKbfsDaemonRpcStatus()
  }
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
const checkIfWeReConnectedToMDServerUpToNTimes = async (n: number) => {
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

// We don't trigger the reachability check at init. Reachability checks cause
// any pending "reconnect" fire right away, and overrides any random back-off
// timer we have at process restart (which is there to avoid surging server
// load around app releases). So only do that when OS network status changes
// after we're up.
const checkKbfsServerReachabilityIfNeeded = async (
  _: unknown,
  action: ConfigGen.OsNetworkStatusChangedPayload
) => {
  if (!action.payload.isInit) {
    try {
      await RPCTypes.SimpleFSSimpleFSCheckReachabilityRpcPromise()
    } catch (error) {
      if (!(error instanceof RPCError)) {
        return
      }
      logger.warn(`failed to check KBFS reachability: ${error.message}`)
    }
  }
  return null
}

const setTlfsAsUnloadedWhenKbfsDaemonDisconnects = () => {
  const kbfsDaemonStatus = Constants.useState.getState().kbfsDaemonStatus
  if (kbfsDaemonStatus.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected) {
    Constants.useState.getState().dispatch.setTlfsAsUnloaded()
  }
}

const setDebugLevel = async (_: unknown, action: FsGen.SetDebugLevelPayload) =>
  RPCTypes.SimpleFSSimpleFSSetDebugLevelRpcPromise({level: action.payload.level})

const subscriptionDeduplicateIntervalSecond = 1

const subscribePath = async (_: unknown, action: FsGen.SubscribePathPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSSubscribePathRpcPromise({
      clientID,
      deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
      kbfsPath: Types.pathToString(action.payload.path),
      subscriptionID: action.payload.subscriptionID,
      topic: action.payload.topic,
    })
    return null
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (error.code === RPCTypes.StatusCode.scteamcontactsettingsblock) {
      // We'll handle this error in loadAdditionalTLF instead.
      return
    }
    Constants.errorToActionOrThrow(error, action.payload.path)
    return
  }
}

const subscribeNonPath = async (_: unknown, action: FsGen.SubscribeNonPathPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
      clientID,
      deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
      subscriptionID: action.payload.subscriptionID,
      topic: action.payload.topic,
    })
    return null
  } catch (err) {
    Constants.errorToActionOrThrow(err)
    return
  }
}

const unsubscribe = async (_: unknown, action: FsGen.UnsubscribePayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSUnsubscribeRpcPromise({
      clientID,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
      subscriptionID: action.payload.subscriptionID,
    })
  } catch (_) {}
}

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

const onNonPathChange = (_: unknown, action: EngineGen.Keybase1NotifyFSFSSubscriptionNotifyPayload) => {
  const {clientID: clientIDFromNotification, topic} = action.payload.params
  if (clientIDFromNotification !== clientID) {
    return null
  }
  switch (topic) {
    case RPCTypes.SubscriptionTopic.favorites:
      Constants.useState.getState().dispatch.favoritesLoad()
      return
    case RPCTypes.SubscriptionTopic.journalStatus:
      return FsGen.createPollJournalStatus()
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

const getOnlineStatus = () => checkIfWeReConnectedToMDServerUpToNTimes(2)

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
  return (
    kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected && [
      ...(oldFsBadgeSubscriptionID
        ? [FsGen.createUnsubscribe({subscriptionID: oldFsBadgeSubscriptionID})]
        : []),
      FsGen.createSubscribeNonPath({
        subscriptionID: fsBadgeSubscriptionID,
        topic: RPCTypes.SubscriptionTopic.filesTabBadge,
      }),
      FsGen.createLoadFilesTabBadge(),
    ]
  )
}

let uploadStatusSubscriptionID: string = ''
const subscribeAndLoadUploadStatus = () => {
  const oldUploadStatusSubscriptionID = uploadStatusSubscriptionID
  uploadStatusSubscriptionID = Constants.makeUUID()
  const kbfsDaemonStatus = Constants.useState.getState().kbfsDaemonStatus

  if (kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) {
    Constants.useState.getState().dispatch.loadUploadStatus()
  }
  return (
    kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected && [
      ...(oldUploadStatusSubscriptionID
        ? [FsGen.createUnsubscribe({subscriptionID: oldUploadStatusSubscriptionID})]
        : []),
      FsGen.createSubscribeNonPath({
        subscriptionID: uploadStatusSubscriptionID,
        topic: RPCTypes.SubscriptionTopic.uploadStatus,
      }),
    ]
  )
}

let journalStatusSubscriptionID: string = ''
const subscribeAndLoadJournalStatus = () => {
  const oldJournalStatusSubscriptionID = journalStatusSubscriptionID
  journalStatusSubscriptionID = Constants.makeUUID()
  const kbfsDaemonStatus = Constants.useState.getState().kbfsDaemonStatus
  return (
    kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected && [
      ...(oldJournalStatusSubscriptionID
        ? [FsGen.createUnsubscribe({subscriptionID: oldJournalStatusSubscriptionID})]
        : []),
      FsGen.createSubscribeNonPath({
        subscriptionID: journalStatusSubscriptionID,
        topic: RPCTypes.SubscriptionTopic.journalStatus,
      }),
      FsGen.createPollJournalStatus(),
    ]
  )
}

let settingsSubscriptionID: string = ''
const subscribeAndLoadSettings = () => {
  const oldSettingsSubscriptionID = settingsSubscriptionID
  settingsSubscriptionID = Constants.makeUUID()
  const kbfsDaemonStatus = Constants.useState.getState().kbfsDaemonStatus
  if (kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected) {
    Constants.useState.getState().dispatch.loadSettings()
  }
  return (
    kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected && [
      ...(oldSettingsSubscriptionID
        ? [FsGen.createUnsubscribe({subscriptionID: oldSettingsSubscriptionID})]
        : []),
      FsGen.createSubscribeNonPath({
        subscriptionID: settingsSubscriptionID,
        topic: RPCTypes.SubscriptionTopic.settings,
      }),
    ]
  )
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
  Container.listenAction(ConfigGen.resetStore, () => {
    Constants.useState.getState().dispatch.resetState()
  })
  Container.listenAction(FsGen.upload, upload)
  Container.listenAction(FsGen.uploadFromDragAndDrop, uploadFromDragAndDrop)
  Container.listenAction(FsGen.dismissUpload, dismissUpload)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, setTlfsAsUnloadedWhenKbfsDaemonDisconnects)
  Container.listenAction(FsGen.letResetUserBackIn, letResetUserBackIn)
  Container.listenAction(FsGen.deleteFile, deleteFile)
  Container.listenAction(FsGen.pollJournalStatus, pollJournalFlushStatusUntilDone)
  Container.listenAction([FsGen.move, FsGen.copy], moveOrCopy)
  Container.listenAction([ConfigGen.installerRan, ConfigGen.loggedInChanged, FsGen.userIn], (_, a) => {
    if (a.type === ConfigGen.loggedInChanged && !ConfigConstants.useConfigState.getState().loggedIn) {
      return
    }
    Constants.useState.getState().dispatch.checkKbfsDaemonRpcStatus()
  })
  Container.listenAction(FsGen.setTlfSyncConfig, setTlfSyncConfig)
  Container.listenAction([FsGen.getOnlineStatus], getOnlineStatus)
  Container.listenAction(ConfigGen.osNetworkStatusChanged, checkKbfsServerReachabilityIfNeeded)
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

  Container.listenAction([FsGen.download, FsGen.shareNative, FsGen.saveMedia], download)
  Container.listenAction(FsGen.cancelDownload, cancelDownload)
  Container.listenAction(FsGen.dismissDownload, dismissDownload)
  Container.listenAction(FsGen.loadDownloadStatus, loadDownloadStatus)
  Container.listenAction(FsGen.loadDownloadInfo, loadDownloadInfo)

  Container.listenAction(FsGen.subscribePath, subscribePath)
  Container.listenAction(FsGen.subscribeNonPath, subscribeNonPath)
  Container.listenAction(FsGen.unsubscribe, unsubscribe)
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
