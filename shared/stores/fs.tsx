import type * as EngineGen from '@/constants/rpc'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import {requestPermissionsToWrite} from '@/util/platform-specific'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {NotifyPopup} from '@/util/misc'
import logger from '@/logger'
import {isMobile} from '@/constants/platform'
import isObject from 'lodash/isObject'
import isEqual from 'lodash/isEqual'
import {navigateAppend} from '@/constants/router'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNotifState} from '@/stores/notifications'
import * as Constants from '@/constants/fs'
import {makeUUID} from '@/util/uuid'
import {
  afterDriverDisableDesktop as afterDriverDisableInPlatform,
  afterDriverDisablingDesktop as afterDriverDisablingInPlatform,
  afterDriverEnabledDesktop as afterDriverEnabledInPlatform,
  afterKbfsDaemonRpcStatusChangedMobile as afterKbfsDaemonRpcStatusChangedInPlatform,
  fuseStatusToDriverStatus,
  openPathInSystemFileManagerDesktop as openPathInSystemFileManagerInPlatform,
  refreshDriverStatusDesktop as refreshDriverStatusInPlatform,
  refreshMountDirsDesktop as refreshMountDirsInPlatform,
  setSfmiBannerDismissedDesktop as setSfmiBannerDismissedInPlatform,
} from './fs-platform'

export * from '@/constants/fs'

const rpcPathToPath = (rpcPath: T.RPCGen.KBFSPath) => T.FS.pathConcat(Constants.defaultPath, rpcPath.path)

const pathFromFolderRPC = (folder: T.RPCGen.Folder): T.FS.Path => {
  const visibility = T.FS.getVisibilityFromRPCFolderType(folder.folderType)
  if (!visibility) return T.FS.stringToPath('')
  return T.FS.stringToPath(`/keybase/${visibility}/${folder.name}`)
}

const fsNotificationTypeToEditType = (
  fsNotificationType: T.RPCChat.Keybase1.FSNotificationType
): T.FS.FileEditType => {
  switch (fsNotificationType) {
    case T.RPCGen.FSNotificationType.fileCreated:
      return T.FS.FileEditType.Created
    case T.RPCGen.FSNotificationType.fileModified:
      return T.FS.FileEditType.Modified
    case T.RPCGen.FSNotificationType.fileDeleted:
      return T.FS.FileEditType.Deleted
    case T.RPCGen.FSNotificationType.fileRenamed:
      return T.FS.FileEditType.Renamed
    default:
      return T.FS.FileEditType.Unknown
  }
}

const userTlfHistoryRPCToState = (
  history: ReadonlyArray<T.RPCGen.FSFolderEditHistory>
): T.FS.UserTlfUpdates =>
  history.flatMap(folder => {
    const path = pathFromFolderRPC(folder.folder)
    return (folder.history ?? []).map(({writerName, edits}) => ({
      history: edits
        ? edits.map(({filename, notificationType, serverTime}) => ({
            editType: fsNotificationTypeToEditType(notificationType),
            filename,
            serverTime,
          }))
        : [],
      path,
      serverTime: folder.serverTime,
      writer: writerName,
    }))
  })

const subscriptionDeduplicateIntervalSecond = 1

export {makeUUID} from '@/util/uuid'

export const clientID = makeUUID()

export const makeEditID = (): T.FS.EditID => T.FS.stringToEditID(makeUUID())

export const resetBannerTypeFromTlf = (tlf: T.FS.Tlf): T.FS.ResetBannerType => {
  const {resetParticipants} = tlf
  if (resetParticipants.length === 0) {
    return T.FS.ResetBannerNoOthersType.None
  }

  const you = useCurrentUserState.getState().username
  if (resetParticipants.findIndex(username => username === you) >= 0) {
    return T.FS.ResetBannerNoOthersType.Self
  }
  return resetParticipants.length
}

const noAccessErrorCodes: Array<T.RPCGen.StatusCode> = [
  T.RPCGen.StatusCode.scsimplefsnoaccess,
  T.RPCGen.StatusCode.scteamnotfound,
  T.RPCGen.StatusCode.scteamreaderror,
]

type ErrorHandlers = {
  checkKbfsDaemonRpcStatus: () => void
  redbar: (error: string) => void
  setPathSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
  setTlfSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
}

export const errorToActionOrThrowWithHandlers = (
  {checkKbfsDaemonRpcStatus, redbar, setPathSoftError, setTlfSoftError}: ErrorHandlers,
  error: unknown,
  path?: T.FS.Path
) => {
  if (!isObject(error)) return
  const code = (error as {code?: T.RPCGen.StatusCode}).code
  if (code === T.RPCGen.StatusCode.sckbfsclienttimeout) {
    checkKbfsDaemonRpcStatus()
    return
  }
  if (code === T.RPCGen.StatusCode.scidentifiesfailed) {
    // This is specifically to address the situation where when user tries to
    // remove a shared TLF from their favorites but another user of the TLF has
    // deleted their account the subscribePath call cauused from the popup will
    // get SCIdentifiesFailed error. We can't do anything here so just move on.
    // (Ideally we'd be able to tell it's becaue the user was deleted, but we
    // don't have that from Go right now.)
    //
    // TODO: TRIAGE-2379 this should probably be ignored on Go side. We
    // already use fsGui identifyBehavior and there's no reason we should get
    // an identify error here.
    return undefined
  }
  if (path && code === T.RPCGen.StatusCode.scsimplefsnotexist) {
    setPathSoftError(path, T.FS.SoftError.Nonexistent)
    return
  }
  if (path && code && noAccessErrorCodes.includes(code)) {
    const tlfPath = Constants.getTlfPath(path)
    if (tlfPath) {
      setTlfSoftError(tlfPath, T.FS.SoftError.NoAccess)
      return
    }
  }
  if (code === T.RPCGen.StatusCode.scdeleted) {
    // The user is deleted. Let user know and move on.
    redbar('A user in this shared folder has deleted their account.')
    return
  }
  throw error
}

export const errorToActionOrThrow = (error: unknown, path?: T.FS.Path) =>
  errorToActionOrThrowWithHandlers(useFSState.getState().dispatch, error, path)

type Store = T.Immutable<{
  badge: T.RPCGen.FilesTabBadge
  criticalUpdate: boolean
  downloads: T.FS.Downloads
  errors: ReadonlyArray<string>
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus
  overallSyncStatus: T.FS.OverallSyncStatus
  settings: T.FS.Settings
  sfmi: T.FS.SystemFileManagerIntegration
  softErrors: T.FS.SoftErrors
  tlfUpdates: T.FS.UserTlfUpdates
  uploads: T.FS.Uploads
}>
const initialStore: Store = {
  badge: T.RPCGen.FilesTabBadge.none,
  criticalUpdate: false,
  downloads: {
    info: new Map(),
    regularDownloads: [],
    state: new Map(),
  },
  errors: [],
  kbfsDaemonStatus: Constants.unknownKbfsDaemonStatus,
  overallSyncStatus: Constants.emptyOverallSyncStatus,
  settings: Constants.emptySettings,
  sfmi: {
    directMountDir: '',
    driverStatus: Constants.defaultDriverStatus,
    preferredMountDirs: [],
  },
  softErrors: {
    pathErrors: new Map(),
    tlfErrors: new Map(),
  },
  tlfUpdates: [],
  uploads: {
    endEstimate: undefined,
    syncingPaths: new Set(),
    totalSyncingBytes: 0,
    writingToJournal: new Map(),
  },
}

export type State = Store & {
  dispatch: {
    afterKbfsDaemonRpcStatusChanged: () => void
    cancelDownload: (downloadID: string) => void
    checkKbfsDaemonRpcStatus: () => void
    dismissDownload: (downloadID: string) => void
    dismissRedbar: (index: number) => void
    dismissUpload: (uploadID: string) => void
    download: (
      path: T.FS.Path,
      type: 'download' | 'share' | 'saveMedia',
      onStarted?: (downloadID: string, downloadIntent?: T.FS.DownloadIntent) => void
    ) => void
    driverDisable: () => void
    driverEnable: (isRetry?: boolean) => void
    getOnlineStatus: () => void
    journalUpdate: (syncingPaths: Array<T.FS.Path>, totalSyncingBytes: number, endEstimate?: number) => void
    loadSettings: () => void
    loadDownloadInfo: (downloadID: string) => void
    loadDownloadStatus: () => void
    onChangedFocus: (appFocused: boolean) => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    redbar: (error: string) => void
    refreshDriverStatusDesktop: () => void
    resetState: () => void
    setCriticalUpdate: (u: boolean) => void
    setDebugLevel: (level: string) => void
    setPathSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
    setSpaceAvailableNotificationThreshold: (spaceAvailableNotificationThreshold: number) => void
    setTlfSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
    upload: (parentPath: T.FS.Path, localPath: string) => void
    userIn: () => void
    userOut: () => void
    userFileEditsLoad: () => void
  }
  getUploadIconForFilesTab: () => T.FS.UploadIcon | undefined
}

const emptyPrefetchInProgress = {
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  startTime: 0,
  state: T.FS.PrefetchState.InProgress,
} satisfies T.FS.PrefetchInProgress

const getPrefetchStatusFromRPC = (
  prefetchStatus: T.RPCGen.PrefetchStatus,
  prefetchProgress: T.RPCGen.PrefetchProgress
) => {
  switch (prefetchStatus) {
    case T.RPCGen.PrefetchStatus.notStarted:
      return Constants.prefetchNotStarted
    case T.RPCGen.PrefetchStatus.inProgress:
      return {
        ...emptyPrefetchInProgress,
        bytesFetched: prefetchProgress.bytesFetched,
        bytesTotal: prefetchProgress.bytesTotal,
        endEstimate: prefetchProgress.endEstimate,
        startTime: prefetchProgress.start,
      }
    case T.RPCGen.PrefetchStatus.complete:
      return Constants.prefetchComplete
    default:
      return Constants.prefetchNotStarted
  }
}

export const useFSState = Z.createZustand<State>('fs', (set, get) => {
  // Can't rely on kbfsDaemonStatus.rpcStatus === 'waiting' as that's set by
  // reducer and happens before this.
  let waitForKbfsDaemonInProgress = false

  const getUploadIconForFilesTab = () => {
    switch (get().badge) {
      case T.RPCGen.FilesTabBadge.awaitingUpload:
        return T.FS.UploadIcon.AwaitingToUpload
      case T.RPCGen.FilesTabBadge.uploadingStuck:
        return T.FS.UploadIcon.UploadingStuck
      case T.RPCGen.FilesTabBadge.uploading:
        return T.FS.UploadIcon.Uploading
      case T.RPCGen.FilesTabBadge.none:
        return undefined
    }
  }

  // At start-up we might have a race where we get connected to a kbfs daemon
  // which dies soon after, and we get an EOF here. So retry for a few times
  // until we get through. After each try we delay for 2s, so this should give us
  // e.g. 12s when n == 6. If it still doesn't work after 12s, something's wrong
  // and we deserve a black bar.
  const checkIfWeReConnectedToMDServerUpToNTimes = async (n: number): Promise<void> => {
    try {
      const onlineStatus = await T.RPCGen.SimpleFSSimpleFSGetOnlineStatusRpcPromise({clientID})
      kbfsDaemonOnlineStatusChanged(onlineStatus)
      return
    } catch (error) {
      if (n > 0) {
        logger.warn(`failed to check if we are connected to MDServer: ${String(error)}; n=${n}`)
        await timeoutPromise(2000)
        return checkIfWeReConnectedToMDServerUpToNTimes(n - 1)
      } else {
        logger.warn(`failed to check if we are connected to MDServer : ${String(error)}; n=${n}, throwing`)
        throw error
      }
    }
  }

  const fsBadgeSub = {id: ''}
  const settingsSub = {id: ''}
  const uploadStatusSub = {id: ''}
  const journalStatusSub = {id: ''}
  let pollJournalStatusPolling = false
  let asyncGeneration = 0

  const shouldRunBackgroundFSRPC = () => {
    const {loggedIn, userSwitching} = useConfigState.getState()
    return loggedIn && !userSwitching
  }

  const isCurrentAsyncGeneration = (generation: number) =>
    generation === asyncGeneration && shouldRunBackgroundFSRPC()

  const clearSubscriptions = () => {
    fsBadgeSub.id = ''
    settingsSub.id = ''
    uploadStatusSub.id = ''
    journalStatusSub.id = ''
  }

  const unsubscribeAll = () => {
    const subscriptionIDs = [fsBadgeSub.id, settingsSub.id, uploadStatusSub.id, journalStatusSub.id]
    subscriptionIDs.forEach(subscriptionID => {
      subscriptionID && unsubscribe(subscriptionID)
    })
    clearSubscriptions()
  }

  const subscribeAndLoad = (sub: {id: string}, topic: T.RPCGen.SubscriptionTopic, load: () => void) => {
    const oldID = sub.id
    sub.id = makeUUID()
    if (get().kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
      if (oldID) unsubscribe(oldID)
      subscribeNonPath(sub.id, topic)
      load()
    }
  }

  const _setSfmiBannerDismissedDesktop = (dismissed: boolean) => {
    const f = async () => {
      try {
        await setSfmiBannerDismissedInPlatform(dismissed)
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    ignorePromise(f())
  }

  const driverDisabling = () => {
    set(s => {
      if (s.sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled) {
        s.sfmi.driverStatus.isDisabling = true
      }
    })
    const f = async () => {
      const {sfmi} = get()
      await afterDriverDisablingInPlatform(sfmi.driverStatus)
      get().dispatch.refreshDriverStatusDesktop()
    }
    ignorePromise(f())
  }

  const driverKextPermissionError = () => {
    set(s => {
      if (s.sfmi.driverStatus.type === T.FS.DriverStatusType.Disabled) {
        s.sfmi.driverStatus.kextPermissionError = true
        s.sfmi.driverStatus.isEnabling = false
      }
    })
  }

  const kbfsDaemonOnlineStatusChanged = (onlineStatus: T.RPCGen.KbfsOnlineStatus) => {
    set(s => {
      switch (onlineStatus) {
        case T.RPCGen.KbfsOnlineStatus.offline:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Offline
          break
        case T.RPCGen.KbfsOnlineStatus.trying:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Trying
          break
        case T.RPCGen.KbfsOnlineStatus.online:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Online
          break
        default:
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Unknown
      }
    })
  }

  const loadFilesTabBadge = () => {
    const f = async () => {
      try {
        const badge = await T.RPCGen.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
        set(s => {
          s.badge = badge
        })
      } catch {
        // retry once HOTPOT-1226
        try {
          const badge = await T.RPCGen.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
          set(s => {
            s.badge = badge
          })
        } catch {}
      }
    }
    ignorePromise(f())
  }

  const loadUploadStatus = () => {
    const f = async () => {
      try {
        const uploadStates = await T.RPCGen.SimpleFSSimpleFSGetUploadStatusRpcPromise()
        set(s => {
          const writingToJournal = new Map(
            uploadStates?.map(uploadState => {
              const path = rpcPathToPath(uploadState.targetPath)
              const oldUploadState = s.uploads.writingToJournal.get(path)
              return [
                path,
                oldUploadState &&
                uploadState.error === oldUploadState.error &&
                uploadState.canceled === oldUploadState.canceled &&
                uploadState.uploadID === oldUploadState.uploadID
                  ? oldUploadState
                  : uploadState,
              ]
            })
          )
          if (!isEqual(writingToJournal, s.uploads.writingToJournal)) {
            s.uploads.writingToJournal = writingToJournal
          }
        })
      } catch (err) {
        errorToActionOrThrow(err)
      }
    }
    ignorePromise(f())
  }

  const onSubscriptionNotify = (cid: string, topic: T.RPCGen.SubscriptionTopic) => {
    const f = async () => {
      if (cid !== clientID || !shouldRunBackgroundFSRPC()) {
        return
      }
      switch (topic) {
        case T.RPCGen.SubscriptionTopic.journalStatus:
          pollJournalStatus()
          break
        case T.RPCGen.SubscriptionTopic.onlineStatus:
          await checkIfWeReConnectedToMDServerUpToNTimes(1)
          break
        case T.RPCGen.SubscriptionTopic.downloadStatus:
          get().dispatch.loadDownloadStatus()
          break
        case T.RPCGen.SubscriptionTopic.uploadStatus:
          loadUploadStatus()
          break
        case T.RPCGen.SubscriptionTopic.filesTabBadge:
          loadFilesTabBadge()
          break
        case T.RPCGen.SubscriptionTopic.settings:
          get().dispatch.loadSettings()
          break
      }
    }
    ignorePromise(f())
  }

  const refreshMountDirsDesktop = () => {
    const f = async () => {
      const {sfmi} = get()
      if (sfmi.driverStatus.type !== T.FS.DriverStatusType.Enabled) {
        return
      }
      try {
        const {directMountDir, preferredMountDirs} = await refreshMountDirsInPlatform()
        setDirectMountDir(directMountDir)
        setPreferredMountDirs(preferredMountDirs)
      } catch (e) {
        errorToActionOrThrow(e)
      }
    }
    ignorePromise(f())
  }

  const setDirectMountDir = (directMountDir: string) => {
    set(s => {
      s.sfmi.directMountDir = directMountDir
    })
  }

  const setDriverStatus = (driverStatus: T.FS.DriverStatus) => {
    set(s => {
      s.sfmi.driverStatus = driverStatus
    })
    refreshMountDirsDesktop()
  }

  const setPreferredMountDirs = (preferredMountDirs: ReadonlyArray<string>) => {
    set(s => {
      s.sfmi.preferredMountDirs = T.castDraft(preferredMountDirs)
    })
  }

  const subscribeNonPath = (subscriptionID: string, topic: T.RPCGen.SubscriptionTopic) => {
    const f = async () => {
      try {
        await T.RPCGen.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
          clientID,
          deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          subscriptionID,
          topic,
        })
      } catch (err) {
        errorToActionOrThrow(err)
      }
    }
    ignorePromise(f())
  }

  const syncStatusChanged = (status: T.RPCGen.FolderSyncStatus) => {
    const diskSpaceStatus = status.outOfSyncSpace
      ? T.FS.DiskSpaceStatus.Error
      : status.localDiskBytesAvailable < get().settings.spaceAvailableNotificationThreshold
        ? T.FS.DiskSpaceStatus.Warning
        : T.FS.DiskSpaceStatus.Ok

    const oldStatus = get().overallSyncStatus.diskSpaceStatus
    set(s => {
      s.overallSyncStatus.syncingFoldersProgress = status.prefetchProgress
      s.overallSyncStatus.diskSpaceStatus = diskSpaceStatus
    })

    // Only notify about the disk space status if it has changed.
    if (oldStatus !== diskSpaceStatus) {
      switch (diskSpaceStatus) {
        case T.FS.DiskSpaceStatus.Error: {
          NotifyPopup('Sync Error', {
            body: 'You are out of disk space. Some folders could not be synced.',
            sound: true,
          })
          useNotifState.getState().dispatch.badgeApp('outOfSpace', status.outOfSyncSpace)
          break
        }
        case T.FS.DiskSpaceStatus.Warning:
          {
            const threshold = Constants.humanizeBytes(get().settings.spaceAvailableNotificationThreshold, 0)
            NotifyPopup('Disk Space Low', {
              body: `You have less than ${threshold} of storage space left.`,
            })
            // Only show the banner if the previous state was OK and the new state
            // is warning. Otherwise we rely on the previous state of the banner.
            if (oldStatus === T.FS.DiskSpaceStatus.Ok) {
              set(s => {
                s.overallSyncStatus.showingBanner = true
              })
            }
          }
          break
        case T.FS.DiskSpaceStatus.Ok:
          break
        default:
      }
    }
  }

  const unsubscribe = (subscriptionID: string) => {
    const f = async () => {
      try {
        await T.RPCGen.SimpleFSSimpleFSUnsubscribeRpcPromise({
          clientID,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
          subscriptionID,
        })
      } catch {}
    }
    ignorePromise(f())
  }

  const pollJournalStatus = () => {
    if (pollJournalStatusPolling || !shouldRunBackgroundFSRPC()) {
      return
    }
    pollJournalStatusPolling = true
    const generation = asyncGeneration

    const getWaitDuration = (endEstimate: number | undefined, lower: number, upper: number): number => {
      if (!endEstimate) {
        return upper
      }
      const diff = endEstimate - Date.now()
      return diff < lower ? lower : diff > upper ? upper : diff
    }

    const f = async () => {
      let shouldRefreshDaemonStatus = false
      try {
        while (isCurrentAsyncGeneration(generation)) {
          const {syncingPaths, totalSyncingBytes, endEstimate} =
            await T.RPCGen.SimpleFSSimpleFSSyncStatusRpcPromise({
              filter: T.RPCGen.ListFilter.filterSystemHidden,
            })
          if (!isCurrentAsyncGeneration(generation)) {
            return
          }
          get().dispatch.journalUpdate(
            (syncingPaths || []).map(T.FS.stringToPath),
            totalSyncingBytes,
            endEstimate ?? undefined
          )

          // It's possible syncingPaths has not been emptied before
          // totalSyncingBytes becomes 0. So check both.
          if (totalSyncingBytes <= 0 && !syncingPaths?.length) {
            break
          }
          useNotifState.getState().dispatch.badgeApp('kbfsUploading', true)
          await timeoutPromise(getWaitDuration(endEstimate || undefined, 100, 4000)) // 0.1s to 4s
        }
      } finally {
        if (generation === asyncGeneration) {
          pollJournalStatusPolling = false
        }
        shouldRefreshDaemonStatus = isCurrentAsyncGeneration(generation)
        useNotifState.getState().dispatch.badgeApp('kbfsUploading', false)
      }
      if (!shouldRefreshDaemonStatus) {
        return
      }
      get().dispatch.checkKbfsDaemonRpcStatus()
    }
    ignorePromise(f())
  }

  const waitForKbfsDaemon = () => {
    if (waitForKbfsDaemonInProgress || !shouldRunBackgroundFSRPC()) {
      return
    }
    waitForKbfsDaemonInProgress = true
    const generation = asyncGeneration
    set(s => {
      s.kbfsDaemonStatus.rpcStatus = T.FS.KbfsDaemonRpcStatus.Waiting
    })
    const f = async () => {
      try {
        await T.RPCGen.configWaitForClientRpcPromise({
          clientType: T.RPCGen.ClientType.kbfs,
          timeout: 60, // 1min. This is arbitrary since we're gonna check again anyway if we're not connected.
        })
      } catch {
      } finally {
        if (generation === asyncGeneration) {
          waitForKbfsDaemonInProgress = false
        }
      }
      if (!isCurrentAsyncGeneration(generation)) {
        return
      }
      get().dispatch.checkKbfsDaemonRpcStatus()
    }
    ignorePromise(f())
  }

  const kbfsDaemonRpcStatusChanged = (rpcStatus: T.FS.KbfsDaemonRpcStatus) => {
    set(s => {
      if (rpcStatus !== T.FS.KbfsDaemonRpcStatus.Connected) {
        s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Offline
      }
      s.kbfsDaemonStatus.rpcStatus = rpcStatus
    })

    subscribeAndLoad(fsBadgeSub, T.RPCGen.SubscriptionTopic.filesTabBadge, loadFilesTabBadge)
    subscribeAndLoad(settingsSub, T.RPCGen.SubscriptionTopic.settings, () => get().dispatch.loadSettings())
    subscribeAndLoad(uploadStatusSub, T.RPCGen.SubscriptionTopic.uploadStatus, loadUploadStatus)
    subscribeAndLoad(journalStatusSub, T.RPCGen.SubscriptionTopic.journalStatus, pollJournalStatus)
    // how this works isn't great. This function gets called way early before we set this
    get().dispatch.afterKbfsDaemonRpcStatusChanged()
  }

  const dispatch: State['dispatch'] = {
    afterKbfsDaemonRpcStatusChanged: () => {
      const f = async () => {
        await afterKbfsDaemonRpcStatusChangedInPlatform()
        if (isMobile) {
          return
        }
        const {kbfsDaemonStatus, dispatch} = get()
        if (kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
          dispatch.refreshDriverStatusDesktop()
        }
        refreshMountDirsDesktop()
      }
      ignorePromise(f())
    },
    cancelDownload: downloadID => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSCancelDownloadRpcPromise({downloadID})
      }
      ignorePromise(f())
    },
    checkKbfsDaemonRpcStatus: () => {
      const f = async () => {
        if (!shouldRunBackgroundFSRPC()) {
          return
        }
        const generation = asyncGeneration
        const connected = await T.RPCGen.configWaitForClientRpcPromise({
          clientType: T.RPCGen.ClientType.kbfs,
          timeout: 0, // Don't wait; just check if it's there.
        })
        if (!isCurrentAsyncGeneration(generation)) {
          return
        }
        const newStatus = connected ? T.FS.KbfsDaemonRpcStatus.Connected : T.FS.KbfsDaemonRpcStatus.Waiting
        const kbfsDaemonStatus = get().kbfsDaemonStatus

        if (kbfsDaemonStatus.rpcStatus !== newStatus) {
          kbfsDaemonRpcStatusChanged(newStatus)
        }
        if (newStatus === T.FS.KbfsDaemonRpcStatus.Waiting) {
          waitForKbfsDaemon()
        }
      }
      ignorePromise(f())
    },
    dismissDownload: downloadID => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSDismissDownloadRpcPromise({downloadID})
      }
      ignorePromise(f())
    },
    dismissRedbar: index => {
      set(s => {
        s.errors = [...s.errors.slice(0, index), ...s.errors.slice(index + 1)]
      })
    },
    dismissUpload: uploadID => {
      const f = async () => {
        try {
          await T.RPCGen.SimpleFSSimpleFSDismissUploadRpcPromise({uploadID})
        } catch {}
      }
      ignorePromise(f())
    },
    download: (path, type, onStarted) => {
      const f = async () => {
        await requestPermissionsToWrite()
        const downloadID = await T.RPCGen.SimpleFSSimpleFSStartDownloadRpcPromise({
          isRegularDownload: type === 'download',
          path: Constants.pathToRPCPath(path).kbfs,
        })
        const downloadIntent =
          type === 'share'
            ? T.FS.DownloadIntent.Share
            : type === 'saveMedia'
              ? T.FS.DownloadIntent.CameraRoll
              : undefined
        set(s => {
          const info = s.downloads.info.get(downloadID)
          s.downloads.info.set(downloadID, {
            filename: info?.filename ?? T.FS.getPathName(path),
            intent: downloadIntent ?? info?.intent,
            isRegularDownload: type === 'download',
            path,
            startTime: info?.startTime ?? 0,
          })
        })
        onStarted?.(downloadID, downloadIntent)
      }
      ignorePromise(f())
    },
    driverDisable: () => {
      const f = async () => {
        const {dispatch, sfmi} = get()
        _setSfmiBannerDismissedDesktop(false)
        const result = await afterDriverDisableInPlatform(sfmi.driverStatus)
        if (result === 'disabling') {
          driverDisabling()
        } else if (result === 'refresh') {
          dispatch.refreshDriverStatusDesktop()
        }
      }
      ignorePromise(f())
    },
    driverEnable: isRetry => {
      set(s => {
        if (s.sfmi.driverStatus.type === T.FS.DriverStatusType.Disabled) {
          s.sfmi.driverStatus.isEnabling = true
        }
      })
      const f = async () => {
        const {dispatch} = get()
        _setSfmiBannerDismissedDesktop(false)
        try {
          const result = await afterDriverEnabledInPlatform(!!isRetry)
          if (result === 'kextPermissionError' || result === 'kextPermissionErrorRetry') {
            driverKextPermissionError()
            if (result === 'kextPermissionError') {
              navigateAppend({name: 'kextPermission', params: {}})
            }
            return
          }
          dispatch.refreshDriverStatusDesktop()
        } catch (e) {
          errorToActionOrThrow(e)
        }
      }
      ignorePromise(f())
    },
    getOnlineStatus: () => {
      const f = async () => {
        await checkIfWeReConnectedToMDServerUpToNTimes(2)
      }
      ignorePromise(f())
    },
    journalUpdate: (syncingPaths, totalSyncingBytes, endEstimate) => {
      set(s => {
        const sp = new Set(syncingPaths)
        if (!isEqual(sp, s.uploads.syncingPaths)) {
          s.uploads.syncingPaths = sp
        }
        s.uploads.totalSyncingBytes = totalSyncingBytes
        s.uploads.endEstimate = endEstimate
      })
    },
    loadDownloadInfo: downloadID => {
      const f = async () => {
        try {
          const res = await T.RPCGen.SimpleFSSimpleFSGetDownloadInfoRpcPromise({
            downloadID,
          })
          set(s => {
            const old = s.downloads.info.get(downloadID)
            s.downloads.info.set(downloadID, {
              filename: res.filename,
              intent: old?.intent,
              isRegularDownload: res.isRegularDownload,
              path: T.FS.stringToPath('/keybase' + res.path.path),
              startTime: res.startTime,
            })
          })
        } catch (error) {
          errorToActionOrThrow(error)
        }
      }
      ignorePromise(f())
    },
    loadDownloadStatus: () => {
      const f = async () => {
        try {
          const res = await T.RPCGen.SimpleFSSimpleFSGetDownloadStatusRpcPromise()

          const regularDownloads = res.regularDownloadIDs || []
          const state = new Map(
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

          set(s => {
            s.downloads.regularDownloads = T.castDraft(regularDownloads)
            s.downloads.state = state

            for (const downloadID of s.downloads.info.keys()) {
              if (!state.has(downloadID)) s.downloads.info.delete(downloadID)
            }
          })
        } catch (error) {
          errorToActionOrThrow(error)
        }
      }
      ignorePromise(f())
    },
    loadSettings: () => {
      const f = async () => {
        set(s => {
          s.settings.isLoading = true
        })
        try {
          const settings = await T.RPCGen.SimpleFSSimpleFSSettingsRpcPromise()
          set(s => {
            const o = s.settings
            o.isLoading = false
            o.loaded = true
            o.sfmiBannerDismissed = settings.sfmiBannerDismissed
            o.spaceAvailableNotificationThreshold = settings.spaceAvailableNotificationThreshold
            o.syncOnCellular = settings.syncOnCellular
          })
        } catch {
          set(s => {
            s.settings.isLoading = false
          })
        }
      }
      ignorePromise(f())
    },
    onChangedFocus: appFocused => {
      const driverStatus = get().sfmi.driverStatus
      if (
        appFocused &&
        driverStatus.type === T.FS.DriverStatusType.Disabled &&
        driverStatus.kextPermissionError
      ) {
        get().dispatch.driverEnable(true)
      }
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case 'keybase.1.NotifyFS.FSOverallSyncStatusChanged':
          syncStatusChanged(action.payload.params.status)
          break
        case 'keybase.1.NotifyFS.FSSubscriptionNotify': {
          const {clientID, topic} = action.payload.params
          onSubscriptionNotify(clientID, topic)
          break
        }
        default:
      }
    },
    redbar: error => {
      set(s => {
        s.errors.push(error)
      })
    },
    refreshDriverStatusDesktop: () => {
      const f = async () => {
        try {
          const previousType = get().sfmi.driverStatus.type
          const status = await refreshDriverStatusInPlatform()
          setDriverStatus(fuseStatusToDriverStatus(status))
          if (status?.kextStarted && previousType === T.FS.DriverStatusType.Disabled) {
            const path = T.FS.stringToPath('/keybase')
            const {sfmi} = get()
            try {
              await openPathInSystemFileManagerInPlatform(path, sfmi.driverStatus, sfmi.directMountDir)
            } catch (e) {
              errorToActionOrThrow(e, path)
            }
          }
        } catch (e) {
          errorToActionOrThrow(e)
        }
      }
      ignorePromise(f())
    },
    resetState: () => {
      asyncGeneration++
      pollJournalStatusPolling = false
      waitForKbfsDaemonInProgress = false
      unsubscribeAll()
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
      }))
    },
    setCriticalUpdate: u => {
      set(s => {
        s.criticalUpdate = u
      })
    },
    setDebugLevel: level => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSSetDebugLevelRpcPromise({level})
      }
      ignorePromise(f())
    },
    setPathSoftError: (path, softError) => {
      set(s => {
        if (softError) {
          s.softErrors.pathErrors.set(path, softError)
        } else {
          s.softErrors.pathErrors.delete(path)
        }
      })
    },
    setSpaceAvailableNotificationThreshold: threshold => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSSetNotificationThresholdRpcPromise({
          threshold,
        })
        get().dispatch.loadSettings()
      }
      ignorePromise(f())
    },
    setTlfSoftError: (path, softError) => {
      set(s => {
        if (softError) {
          s.softErrors.tlfErrors.set(path, softError)
        } else {
          s.softErrors.tlfErrors.delete(path)
        }
      })
    },
    upload: (parentPath, localPath) => {
      const f = async () => {
        try {
          await T.RPCGen.SimpleFSSimpleFSStartUploadRpcPromise({
            sourceLocalPath: T.FS.getNormalizedLocalPath(localPath),
            targetParentPath: Constants.pathToRPCPath(parentPath).kbfs,
          })
        } catch (err) {
          errorToActionOrThrow(err)
        }
      }
      ignorePromise(f())
    },
    userFileEditsLoad: () => {
      const f = async () => {
        if (!shouldRunBackgroundFSRPC()) {
          return
        }
        const generation = asyncGeneration
        try {
          const writerEdits = await T.RPCGen.SimpleFSSimpleFSUserEditHistoryRpcPromise()
          if (!isCurrentAsyncGeneration(generation)) {
            return
          }
          set(s => {
            s.tlfUpdates = T.castDraft(userTlfHistoryRPCToState(writerEdits || []))
          })
        } catch (error) {
          if (!isCurrentAsyncGeneration(generation)) {
            return
          }
          errorToActionOrThrow(error)
        }
      }
      ignorePromise(f())
    },
    userIn: () => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSUserInRpcPromise({clientID})
      }
      ignorePromise(f())
      get().dispatch.checkKbfsDaemonRpcStatus()
    },
    userOut: () => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSUserOutRpcPromise({clientID})
      }
      ignorePromise(f())
    },
  }

  return {
    ...initialStore,
    dispatch,
    getUploadIconForFilesTab,
  }
})
