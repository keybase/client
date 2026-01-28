import * as EngineGen from '@/actions/engine-gen-gen'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import * as S from '@/constants/strings'
import {requestPermissionsToWrite} from '@/util/platform-specific'
import * as Tabs from '@/constants/tabs'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import NotifyPopup from '@/util/notify-popup'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import {tlfToPreferredOrder} from '@/util/kbfs'
import isObject from 'lodash/isObject'
import isEqual from 'lodash/isEqual'
import {navigateAppend, navigateUp} from '@/constants/router2'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Constants from '@/constants/fs'

export * from '@/constants/fs'

const tlfSyncEnabled: T.FS.TlfSyncEnabled = {
  mode: T.FS.TlfSyncMode.Enabled,
}

const tlfSyncDisabled: T.FS.TlfSyncDisabled = {
  mode: T.FS.TlfSyncMode.Disabled,
}

const makeTlfSyncPartial = ({
  enabledPaths,
}: {
  enabledPaths?: T.FS.TlfSyncPartial['enabledPaths']
}): T.FS.TlfSyncPartial => ({
  enabledPaths: [...(enabledPaths || [])],
  mode: T.FS.TlfSyncMode.Partial,
})

const makeConflictStateNormalView = ({
  localViewTlfPaths,
  resolvingConflict,
  stuckInConflict,
}: Partial<T.FS.ConflictStateNormalView>): T.FS.ConflictStateNormalView => ({
  localViewTlfPaths: [...(localViewTlfPaths || [])],
  resolvingConflict: resolvingConflict || false,
  stuckInConflict: stuckInConflict || false,
  type: T.FS.ConflictStateType.NormalView,
})

const tlfNormalViewWithNoConflict = makeConflictStateNormalView({})

const makeConflictStateManualResolvingLocalView = ({
  normalViewTlfPath,
}: Partial<T.FS.ConflictStateManualResolvingLocalView>): T.FS.ConflictStateManualResolvingLocalView => ({
  normalViewTlfPath: normalViewTlfPath || Constants.defaultPath,
  type: T.FS.ConflictStateType.ManualResolvingLocalView,
})

const makeTlf = (p: Partial<T.FS.Tlf>): T.FS.Tlf => {
  const {conflictState, isFavorite, isIgnored, isNew, name, resetParticipants, syncConfig, teamId, tlfMtime} =
    p
  return {
    conflictState: conflictState || tlfNormalViewWithNoConflict,
    isFavorite: isFavorite || false,
    isIgnored: isIgnored || false,
    isNew: isNew || false,
    name: name || '',
    resetParticipants: [...(resetParticipants || [])],
    syncConfig: syncConfig || tlfSyncDisabled,
    teamId: teamId || '',
    tlfMtime: tlfMtime || 0,
    /* See comment in constants/types/fs.js
      needsRekey: false,
      waitingForParticipantUnlock: I.List(),
      youCanUnlock: I.List(),
      */
  }
}

const rpcFolderTypeToTlfType = (rpcFolderType: T.RPCGen.FolderType) => {
  switch (rpcFolderType) {
    case T.RPCGen.FolderType.private:
      return T.FS.TlfType.Private
    case T.RPCGen.FolderType.public:
      return T.FS.TlfType.Public
    case T.RPCGen.FolderType.team:
      return T.FS.TlfType.Team
    default:
      return null
  }
}

const rpcPathToPath = (rpcPath: T.RPCGen.KBFSPath) => T.FS.pathConcat(Constants.defaultPath, rpcPath.path)

const pathFromFolderRPC = (folder: T.RPCGen.Folder): T.FS.Path => {
  const visibility = T.FS.getVisibilityFromRPCFolderType(folder.folderType)
  if (!visibility) return T.FS.stringToPath('')
  return T.FS.stringToPath(`/keybase/${visibility}/${folder.name}`)
}

const folderRPCFromPath = (path: T.FS.Path): T.RPCGen.FolderHandle | undefined => {
  const pathElems = T.FS.getPathElements(path)
  if (pathElems.length === 0) return undefined

  const visibility = T.FS.getVisibilityFromElems(pathElems)
  if (visibility === undefined) return undefined

  const name = T.FS.getPathNameFromElems(pathElems)
  if (name === '') return undefined

  return {
    created: false,
    folderType: T.FS.getRPCFolderTypeFromVisibility(visibility),
    name,
  }
}

const rpcConflictStateToConflictState = (rpcConflictState?: T.RPCGen.ConflictState): T.FS.ConflictState => {
  if (rpcConflictState) {
    if (rpcConflictState.conflictStateType === T.RPCGen.ConflictStateType.normalview) {
      const nv = rpcConflictState.normalview
      return makeConflictStateNormalView({
        localViewTlfPaths: (nv.localViews || []).reduce<Array<T.FS.Path>>((arr, p) => {
          p.PathType === T.RPCGen.PathType.kbfs && arr.push(rpcPathToPath(p.kbfs))
          return arr
        }, []),
        resolvingConflict: nv.resolvingConflict,
        stuckInConflict: nv.stuckInConflict,
      })
    } else {
      const nv = rpcConflictState.manualresolvinglocalview.normalView
      return makeConflictStateManualResolvingLocalView({
        normalViewTlfPath:
          nv.PathType === T.RPCGen.PathType.kbfs ? rpcPathToPath(nv.kbfs) : Constants.defaultPath,
      })
    }
  } else {
    return tlfNormalViewWithNoConflict
  }
}

const getSyncConfigFromRPC = (
  tlfName: string,
  tlfType: T.FS.TlfType,
  config?: T.RPCGen.FolderSyncConfig
): T.FS.TlfSyncConfig => {
  if (!config) {
    return tlfSyncDisabled
  }
  switch (config.mode) {
    case T.RPCGen.FolderSyncMode.disabled:
      return tlfSyncDisabled
    case T.RPCGen.FolderSyncMode.enabled:
      return tlfSyncEnabled
    case T.RPCGen.FolderSyncMode.partial:
      return makeTlfSyncPartial({
        enabledPaths: config.paths
          ? config.paths.map(str => T.FS.getPathFromRelative(tlfName, tlfType, str))
          : [],
      })
    default:
      return tlfSyncDisabled
  }
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
): T.FS.UserTlfUpdates => {
  let updates: Array<T.FS.TlfUpdate> = []
  history.forEach(folder => {
    const updateServerTime = folder.serverTime
    const path = pathFromFolderRPC(folder.folder)
    const tlfUpdates = folder.history
      ? folder.history.map(({writerName, edits}) => ({
          history: edits
            ? edits.map(({filename, notificationType, serverTime}) => ({
                editType: fsNotificationTypeToEditType(notificationType),
                filename,
                serverTime,
              }))
            : [],
          path,
          serverTime: updateServerTime,
          writer: writerName,
        }))
      : []
    updates = updates.concat(tlfUpdates)
  })
  return updates
}

const subscriptionDeduplicateIntervalSecond = 1

// RPC expects a string that's interpreted as [16]byte on Go side and it has to
// be unique among all ongoing ops at any given time. uuidv1 may exceed 16
// bytes, so just roll something simple that's seeded with time.
//
// MAX_SAFE_INTEGER after toString(36) is 11 characters, so this should take <=
// 12 chars
const uuidSeed = Date.now().toString(36) + '-'
let counter = 0
// We have 36^4=1,679,616 of space to work with in order to not exceed 16
// bytes.
const counterMod = 36 * 36 * 36 * 36
export const makeUUID = () => {
  counter = (counter + 1) % counterMod
  return uuidSeed + counter.toString(36)
}

export const clientID = makeUUID()

export const makeEditID = (): T.FS.EditID => T.FS.stringToEditID(makeUUID())

export const resetBannerType = (s: State, path: T.FS.Path): T.FS.ResetBannerType => {
  const resetParticipants = Constants.getTlfFromPath(s.tlfs, path).resetParticipants
  if (resetParticipants.length === 0) {
    return T.FS.ResetBannerNoOthersType.None
  }

  const you = useCurrentUserState.getState().username
  if (resetParticipants.findIndex(username => username === you) >= 0) {
    return T.FS.ResetBannerNoOthersType.Self
  }
  return resetParticipants.length
}

export const makeActionsForDestinationPickerOpen = (index: number, path: T.FS.Path) => {
  useFSState.getState().dispatch.setDestinationPickerParentPath(index, path)
  navigateAppend({props: {index}, selected: 'destinationPicker'})
}

const noAccessErrorCodes: Array<T.RPCGen.StatusCode> = [
  T.RPCGen.StatusCode.scsimplefsnoaccess,
  T.RPCGen.StatusCode.scteamnotfound,
  T.RPCGen.StatusCode.scteamreaderror,
]

export const errorToActionOrThrow = (error: unknown, path?: T.FS.Path) => {
  if (!isObject(error)) return
  const code = (error as {code?: T.RPCGen.StatusCode}).code
  if (code === T.RPCGen.StatusCode.sckbfsclienttimeout) {
    useFSState.getState().dispatch.checkKbfsDaemonRpcStatus()
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
    useFSState.getState().dispatch.setPathSoftError(path, T.FS.SoftError.Nonexistent)
    return
  }
  if (path && code && noAccessErrorCodes.includes(code)) {
    const tlfPath = Constants.getTlfPath(path)
    if (tlfPath) {
      useFSState.getState().dispatch.setTlfSoftError(tlfPath, T.FS.SoftError.NoAccess)
      return
    }
  }
  if (code === T.RPCGen.StatusCode.scdeleted) {
    // The user is deleted. Let user know and move on.
    useFSState.getState().dispatch.redbar('A user in this shared folder has deleted their account.')
    return
  }
  throw error
}

type Store = T.Immutable<{
  badge: T.RPCGen.FilesTabBadge
  criticalUpdate: boolean
  destinationPicker: T.FS.DestinationPicker
  downloads: T.FS.Downloads
  edits: T.FS.Edits
  errors: ReadonlyArray<string>
  fileContext: ReadonlyMap<T.FS.Path, T.FS.FileContext>
  folderViewFilter: string | undefined // on mobile, '' is expanded empty, undefined is unexpanded
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus
  lastPublicBannerClosedTlf: string
  overallSyncStatus: T.FS.OverallSyncStatus
  pathItemActionMenu: T.FS.PathItemActionMenu
  pathItems: T.FS.PathItems
  pathInfos: ReadonlyMap<T.FS.Path, T.FS.PathInfo>
  pathUserSettings: ReadonlyMap<T.FS.Path, T.FS.PathUserSetting>
  settings: T.FS.Settings
  sfmi: T.FS.SystemFileManagerIntegration
  softErrors: T.FS.SoftErrors
  tlfUpdates: T.FS.UserTlfUpdates
  tlfs: T.FS.Tlfs
  uploads: T.FS.Uploads
}>
const initialStore: Store = {
  badge: T.RPCGen.FilesTabBadge.none,
  criticalUpdate: false,
  destinationPicker: {
    destinationParentPath: [],
    source: {
      type: T.FS.DestinationPickerSource.None,
    },
  },
  downloads: {
    info: new Map(),
    regularDownloads: [],
    state: new Map(),
  },
  edits: new Map(),
  errors: [],
  fileContext: new Map(),
  folderViewFilter: undefined,
  kbfsDaemonStatus: Constants.unknownKbfsDaemonStatus,
  lastPublicBannerClosedTlf: '',
  overallSyncStatus: Constants.emptyOverallSyncStatus,
  pathInfos: new Map(),
  pathItemActionMenu: Constants.emptyPathItemActionMenu,
  pathItems: new Map(),
  pathUserSettings: new Map(),
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
  tlfs: {
    additionalTlfs: new Map(),
    loaded: false,
    private: new Map(),
    public: new Map(),
    team: new Map(),
  },
  uploads: {
    endEstimate: undefined,
    syncingPaths: new Set(),
    totalSyncingBytes: 0,
    writingToJournal: new Map(),
  },
}

export interface State extends Store {
  dispatch: {
    cancelDownload: (downloadID: string) => void
    checkKbfsDaemonRpcStatus: () => void
    commitEdit: (editID: T.FS.EditID) => void
    deleteFile: (path: T.FS.Path) => void
    discardEdit: (editID: T.FS.EditID) => void
    dismissDownload: (downloadID: string) => void
    dismissRedbar: (index: number) => void
    dismissUpload: (uploadID: string) => void
    download: (path: T.FS.Path, type: 'download' | 'share' | 'saveMedia') => void
    driverDisable: () => void
    driverDisabling: () => void
    driverEnable: (isRetry?: boolean) => void
    driverKextPermissionError: () => void
    defer: {
      afterDriverDisable?: () => void
      afterDriverDisabling?: () => void
      afterDriverEnabled?: (isRetry: boolean) => void
      afterKbfsDaemonRpcStatusChanged?: () => void
      finishedDownloadWithIntentMobile?: (
        downloadID: string,
        downloadIntent: T.FS.DownloadIntent,
        mimeType: string
      ) => void
      finishedRegularDownloadMobile?: (downloadID: string, mimeType: string) => void
      openFilesFromWidgetDesktop?: (path: T.FS.Path) => void
      openAndUploadDesktop?: (type: T.FS.OpenDialogType, parentPath: T.FS.Path) => void
      pickAndUploadMobile?: (type: T.FS.MobilePickType, parentPath: T.FS.Path) => void
      openLocalPathInSystemFileManagerDesktop?: (localPath: string) => void
      openPathInSystemFileManagerDesktop?: (path: T.FS.Path) => void
      openSecurityPreferencesDesktop?: () => void
      refreshDriverStatusDesktop?: () => void
      refreshMountDirsDesktop?: () => void
      setSfmiBannerDismissedDesktop?: (dismissed: boolean) => void
      uploadFromDragAndDropDesktop?: (parentPath: T.FS.Path, localPaths: Array<string>) => void
      onBadgeApp?: (key: 'kbfsUploading' | 'outOfSpace', on: boolean) => void
      onSetBadgeCounts?: (counts: Map<Tabs.Tab, number>) => void
    }
    editError: (editID: T.FS.EditID, error: string) => void
    editSuccess: (editID: T.FS.EditID) => void
    favoritesLoad: () => void
    favoriteIgnore: (path: T.FS.Path) => void
    finishManualConflictResolution: (localViewTlfPath: T.FS.Path) => void
    folderListLoad: (path: T.FS.Path, recursive: boolean) => void
    getOnlineStatus: () => void
    journalUpdate: (syncingPaths: Array<T.FS.Path>, totalSyncingBytes: number, endEstimate?: number) => void
    kbfsDaemonOnlineStatusChanged: (onlineStatus: T.RPCGen.KbfsOnlineStatus) => void
    kbfsDaemonRpcStatusChanged: (rpcStatus: T.FS.KbfsDaemonRpcStatus) => void
    letResetUserBackIn: (id: T.RPCGen.TeamID, username: string) => void
    loadAdditionalTlf: (tlfPath: T.FS.Path) => void
    loadFileContext: (path: T.FS.Path) => void
    loadFilesTabBadge: () => void
    loadPathInfo: (path: T.FS.Path) => void
    loadPathMetadata: (path: T.FS.Path) => void
    loadSettings: () => void
    loadTlfSyncConfig: (tlfPath: T.FS.Path) => void
    loadUploadStatus: () => void
    loadDownloadInfo: (downloadID: string) => void
    loadDownloadStatus: () => void
    loadedPathInfo: (path: T.FS.Path, info: T.FS.PathInfo) => void
    newFolderRow: (parentPath: T.FS.Path) => void
    moveOrCopy: (destinationParentPath: T.FS.Path, type: 'move' | 'copy') => void
    onChangedFocus: (appFocused: boolean) => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    onPathChange: (
      clientID: string,
      path: string,
      topics: ReadonlyArray<T.RPCGen.PathSubscriptionTopic>
    ) => void
    onSubscriptionNotify: (clientID: string, topic: T.RPCGen.SubscriptionTopic) => void
    pollJournalStatus: () => void
    redbar: (error: string) => void
    resetState: () => void
    setCriticalUpdate: (u: boolean) => void
    setDebugLevel: (level: string) => void
    setDestinationPickerParentPath: (index: number, path: T.FS.Path) => void
    setDirectMountDir: (directMountDir: string) => void
    setDriverStatus: (driverStatus: T.FS.DriverStatus) => void
    setEditName: (editID: T.FS.EditID, name: string) => void
    setFolderViewFilter: (filter?: string) => void
    setIncomingShareSource: (source: ReadonlyArray<T.RPCGen.IncomingShareItem>) => void
    setLastPublicBannerClosedTlf: (tlf: string) => void
    setMoveOrCopySource: (path: T.FS.Path) => void
    setPathItemActionMenuDownload: (downloadID?: string, intent?: T.FS.DownloadIntent) => void
    setPathItemActionMenuView: (view: T.FS.PathItemActionMenuView) => void
    setPreferredMountDirs: (preferredMountDirs: ReadonlyArray<string>) => void
    setPathSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
    setSpaceAvailableNotificationThreshold: (spaceAvailableNotificationThreshold: number) => void
    setTlfSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
    setTlfsAsUnloaded: () => void
    setTlfSyncConfig: (tlfPath: T.FS.Path, enabled: boolean) => void
    setSorting: (path: T.FS.Path, sortSetting: T.FS.SortSetting) => void
    showIncomingShare: (initialDestinationParentPath: T.FS.Path) => void
    showMoveOrCopy: (initialDestinationParentPath: T.FS.Path) => void
    startManualConflictResolution: (tlfPath: T.FS.Path) => void
    startRename: (path: T.FS.Path) => void
    subscribeNonPath: (subscriptionID: string, topic: T.RPCGen.SubscriptionTopic) => void
    subscribePath: (subscriptionID: string, path: T.FS.Path, topic: T.RPCGen.PathSubscriptionTopic) => void
    syncStatusChanged: (status: T.RPCGen.FolderSyncStatus) => void
    unsubscribe: (subscriptionID: string) => void
    upload: (parentPath: T.FS.Path, localPath: string) => void
    userIn: () => void
    userOut: () => void
    userFileEditsLoad: () => void
    waitForKbfsDaemon: () => void
  }
  getUploadIconForFilesTab: () => T.FS.UploadIcon | undefined
}

const emptyPrefetchInProgress: T.FS.PrefetchInProgress = {
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  startTime: 0,
  state: T.FS.PrefetchState.InProgress,
}

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

const direntToMetadata = (d: T.RPCGen.Dirent) => ({
  lastModifiedTimestamp: d.time,
  lastWriter: d.lastWriterUnverified.username,
  name: d.name.split('/').pop(),
  prefetchStatus: getPrefetchStatusFromRPC(d.prefetchStatus, d.prefetchProgress),
  size: d.size,
  writable: d.writable,
})

const makeEntry = (d: T.RPCGen.Dirent, children?: Set<string>): T.FS.PathItem => {
  switch (d.direntType) {
    case T.RPCGen.DirentType.dir:
      return {
        ...Constants.emptyFolder,
        ...direntToMetadata(d),
        children: new Set(children || []),
        progress: children ? T.FS.ProgressType.Loaded : T.FS.ProgressType.Pending,
      } as T.FS.PathItem
    case T.RPCGen.DirentType.sym:
      return {
        ...Constants.emptySymlink,
        ...direntToMetadata(d),
        // TODO: plumb link target
      } as T.FS.PathItem
    case T.RPCGen.DirentType.file:
    case T.RPCGen.DirentType.exec:
      return {
        ...Constants.emptyFile,
        ...direntToMetadata(d),
      } as T.FS.PathItem
  }
}

const updatePathItem = (
  oldPathItem: T.Immutable<T.FS.PathItem>,
  newPathItemFromAction: T.Immutable<T.FS.PathItem>
): T.Immutable<T.FS.PathItem> => {
  if (
    oldPathItem.type === T.FS.PathType.Folder &&
    newPathItemFromAction.type === T.FS.PathType.Folder &&
    oldPathItem.progress === T.FS.ProgressType.Loaded &&
    newPathItemFromAction.progress === T.FS.ProgressType.Pending
  ) {
    // The new one doesn't have children, but the old one has. We don't
    // want to override a loaded folder into pending. So first set the children
    // in new one using what we already have, see if they are equal.
    const newPathItemNoOverridingChildrenAndProgress = {
      ...newPathItemFromAction,
      children: oldPathItem.children,
      progress: T.FS.ProgressType.Loaded,
    }
    return newPathItemNoOverridingChildrenAndProgress
  }
  return newPathItemFromAction
}

export const useFSState = Z.createZustand<State>((set, get) => {
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
      get().dispatch.kbfsDaemonOnlineStatusChanged(onlineStatus)
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

  let fsBadgeSubscriptionID: string = ''
  let settingsSubscriptionID: string = ''
  let uploadStatusSubscriptionID: string = ''
  let journalStatusSubscriptionID: string = ''
  let pollJournalStatusPolling = false

  const dispatch: State['dispatch'] = {
    cancelDownload: downloadID => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSCancelDownloadRpcPromise({downloadID})
      }
      ignorePromise(f())
    },
    checkKbfsDaemonRpcStatus: () => {
      const f = async () => {
        const connected = await T.RPCGen.configWaitForClientRpcPromise({
          clientType: T.RPCGen.ClientType.kbfs,
          timeout: 0, // Don't wait; just check if it's there.
        })
        const newStatus = connected ? T.FS.KbfsDaemonRpcStatus.Connected : T.FS.KbfsDaemonRpcStatus.Waiting
        const kbfsDaemonStatus = get().kbfsDaemonStatus
        const {kbfsDaemonRpcStatusChanged, waitForKbfsDaemon} = get().dispatch

        if (kbfsDaemonStatus.rpcStatus !== newStatus) {
          kbfsDaemonRpcStatusChanged(newStatus)
        }
        if (newStatus === T.FS.KbfsDaemonRpcStatus.Waiting) {
          waitForKbfsDaemon()
        }
      }
      ignorePromise(f())
    },
    commitEdit: editID => {
      const edit = get().edits.get(editID)
      if (!edit) {
        return
      }
      const f = async () => {
        switch (edit.type) {
          case T.FS.EditType.NewFolder:
            try {
              await T.RPCGen.SimpleFSSimpleFSOpenRpcPromise(
                {
                  dest: Constants.pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.name)),
                  flags: T.RPCGen.OpenFlags.directory,
                  opID: makeUUID(),
                },
                S.waitingKeyFSCommitEdit
              )
              get().dispatch.editSuccess(editID)
              return
            } catch (e) {
              errorToActionOrThrow(e, edit.parentPath)
              return
            }
          case T.FS.EditType.Rename:
            try {
              const opID = makeUUID()
              await T.RPCGen.SimpleFSSimpleFSMoveRpcPromise({
                dest: Constants.pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.name)),
                opID,
                overwriteExistingFiles: false,
                src: Constants.pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.originalName)),
              })
              await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID}, S.waitingKeyFSCommitEdit)
              get().dispatch.editSuccess(editID)
              return
            } catch (error) {
              if (!(error instanceof RPCError)) {
                return
              }
              if (
                [
                  T.RPCGen.StatusCode.scsimplefsnameexists,
                  T.RPCGen.StatusCode.scsimplefsdirnotempty,
                ].includes(error.code)
              ) {
                get().dispatch.editError(editID, error.desc || 'name exists')
                return
              }
              throw error
            }
        }
      }
      ignorePromise(f())
    },
    defer: {
      afterDriverDisable: undefined,
      afterDriverDisabling: undefined,
      afterDriverEnabled: undefined,
      afterKbfsDaemonRpcStatusChanged: undefined,
      finishedDownloadWithIntentMobile: undefined,
      finishedRegularDownloadMobile: undefined,
      onBadgeApp: () => {
        throw new Error('onBadgeApp not implemented')
      },
      onSetBadgeCounts: () => {
        throw new Error('onSetBadgeCounts not implemented')
      },
      openAndUploadDesktop: undefined,
      openFilesFromWidgetDesktop: undefined,
      openLocalPathInSystemFileManagerDesktop: undefined,
      openPathInSystemFileManagerDesktop: undefined,
      openSecurityPreferencesDesktop: undefined,
      pickAndUploadMobile: undefined,
      refreshDriverStatusDesktop: undefined,
      refreshMountDirsDesktop: undefined,
      setSfmiBannerDismissedDesktop: undefined,
      uploadFromDragAndDropDesktop: undefined,
    },
    deleteFile: path => {
      const f = async () => {
        const opID = makeUUID()
        try {
          await T.RPCGen.SimpleFSSimpleFSRemoveRpcPromise({
            opID,
            path: Constants.pathToRPCPath(path),
            recursive: true,
          })
          await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID})
        } catch (e) {
          errorToActionOrThrow(e, path)
        }
      }
      ignorePromise(f())
    },
    discardEdit: editID => {
      set(s => {
        s.edits.delete(editID)
      })
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
    download: (path, type) => {
      const f = async () => {
        await requestPermissionsToWrite()
        const downloadID = await T.RPCGen.SimpleFSSimpleFSStartDownloadRpcPromise({
          isRegularDownload: type === 'download',
          path: Constants.pathToRPCPath(path).kbfs,
        })
        if (type !== 'download') {
          get().dispatch.setPathItemActionMenuDownload(
            downloadID,
            type === 'share' ? T.FS.DownloadIntent.Share : T.FS.DownloadIntent.CameraRoll
          )
        }
      }
      ignorePromise(f())
    },
    driverDisable: () => {
      get().dispatch.defer.afterDriverDisable?.()
    },
    driverDisabling: () => {
      set(s => {
        if (s.sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled) {
          s.sfmi.driverStatus.isDisabling = true
        }
      })
      get().dispatch.defer.afterDriverDisabling?.()
    },
    driverEnable: isRetry => {
      set(s => {
        if (s.sfmi.driverStatus.type === T.FS.DriverStatusType.Disabled) {
          s.sfmi.driverStatus.isEnabling = true
        }
      })
      get().dispatch.defer.afterDriverEnabled?.(!!isRetry)
    },
    driverKextPermissionError: () => {
      set(s => {
        if (s.sfmi.driverStatus.type === T.FS.DriverStatusType.Disabled) {
          s.sfmi.driverStatus.kextPermissionError = true
          s.sfmi.driverStatus.isEnabling = false
        }
      })
    },
    editError: (editID, error) => {
      set(s => {
        const e = s.edits.get(editID)
        if (e) e.error = error
      })
    },
    editSuccess: editID => {
      set(s => {
        s.edits.delete(editID)
      })
    },
    favoriteIgnore: path => {
      const f = async () => {
        const folder = folderRPCFromPath(path)
        if (!folder) {
          throw new Error('No folder specified')
        }
        try {
          await T.RPCGen.favoriteFavoriteIgnoreRpcPromise({folder})
        } catch (error) {
          errorToActionOrThrow(error, path)
          set(s => {
            const elems = T.FS.getPathElements(path)
            const visibility = T.FS.getVisibilityFromElems(elems)
            if (!visibility) {
              return
            }
            s.tlfs[visibility] = new Map(s.tlfs[visibility])
            s.tlfs[visibility].set(
              elems[2] ?? '',
              T.castDraft({
                ...(s.tlfs[visibility].get(elems[2] ?? '') || Constants.unknownTlf),
                isIgnored: false,
              })
            )
          })
        }
      }
      set(s => {
        const elems = T.FS.getPathElements(path)
        const visibility = T.FS.getVisibilityFromElems(elems)
        if (!visibility) {
          return
        }
        s.tlfs[visibility] = new Map(s.tlfs[visibility])
        s.tlfs[visibility].set(
          elems[2] ?? '',
          T.castDraft({
            ...(s.tlfs[visibility].get(elems[2] ?? '') || Constants.unknownTlf),
            isIgnored: true,
          })
        )
      })
      ignorePromise(f())
    },
    favoritesLoad: () => {
      const f = async () => {
        try {
          if (!useConfigState.getState().loggedIn) {
            return
          }
          const results = await T.RPCGen.SimpleFSSimpleFSListFavoritesRpcPromise()
          const payload = {
            private: new Map<string, T.FS.Tlf>(),
            public: new Map<string, T.FS.Tlf>(),
            team: new Map<string, T.FS.Tlf>(),
          } as const
          const fs = [
            ...(results.favoriteFolders
              ? [{folders: results.favoriteFolders, isFavorite: true, isIgnored: false, isNew: false}]
              : []),
            ...(results.ignoredFolders
              ? [{folders: results.ignoredFolders, isFavorite: false, isIgnored: true, isNew: false}]
              : []),
            ...(results.newFolders
              ? [{folders: results.newFolders, isFavorite: true, isIgnored: false, isNew: true}]
              : []),
          ]
          fs.forEach(({folders, isFavorite, isIgnored, isNew}) =>
            folders.forEach(folder => {
              const tlfType = rpcFolderTypeToTlfType(folder.folderType)
              const tlfName =
                tlfType === T.FS.TlfType.Private || tlfType === T.FS.TlfType.Public
                  ? tlfToPreferredOrder(folder.name, useCurrentUserState.getState().username)
                  : folder.name
              tlfType &&
                payload[tlfType].set(
                  tlfName,
                  makeTlf({
                    conflictState: rpcConflictStateToConflictState(folder.conflictState || undefined),
                    isFavorite,
                    isIgnored,
                    isNew,
                    name: tlfName,
                    resetParticipants: (folder.reset_members || []).map(({username}) => username),
                    syncConfig: getSyncConfigFromRPC(tlfName, tlfType, folder.syncConfig || undefined),
                    teamId: folder.team_id || '',
                    tlfMtime: folder.mtime || 0,
                  })
                )
            })
          )

          if (payload.private.size) {
            set(s => {
              s.tlfs.private = T.castDraft(payload.private)
              s.tlfs.public = T.castDraft(payload.public)
              s.tlfs.team = T.castDraft(payload.team)
              s.tlfs.loaded = true
            })
            const counts = new Map<Tabs.Tab, number>()
            counts.set(Tabs.fsTab, Constants.computeBadgeNumberForAll(get().tlfs))
            get().dispatch.defer.onSetBadgeCounts?.(counts)
          }
        } catch (e) {
          errorToActionOrThrow(e)
        }
        return
      }
      ignorePromise(f())
    },
    finishManualConflictResolution: localViewTlfPath => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSFinishResolvingConflictRpcPromise({
          path: Constants.pathToRPCPath(localViewTlfPath),
        })
        get().dispatch.favoritesLoad()
      }
      ignorePromise(f())
    },
    folderListLoad: (rootPath, isRecursive) => {
      const f = async () => {
        try {
          const opID = makeUUID()
          if (isRecursive) {
            await T.RPCGen.SimpleFSSimpleFSListRecursiveToDepthRpcPromise({
              depth: 1,
              filter: T.RPCGen.ListFilter.filterSystemHidden,
              opID,
              path: Constants.pathToRPCPath(rootPath),
              refreshSubscription: false,
            })
          } else {
            await T.RPCGen.SimpleFSSimpleFSListRpcPromise({
              filter: T.RPCGen.ListFilter.filterSystemHidden,
              opID,
              path: Constants.pathToRPCPath(rootPath),
              refreshSubscription: false,
            })
          }

          await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID}, S.waitingKeyFSFolderList)

          const result = await T.RPCGen.SimpleFSSimpleFSReadListRpcPromise({opID})
          const entries = result.entries || []
          const childMap = entries.reduce((m, d) => {
            const [parent, child] = d.name.split('/')
            if (child) {
              // Only add to the children set if the parent definitely has children.
              const fullParent = T.FS.pathConcat(rootPath, parent ?? '')
              let children = m.get(fullParent)
              if (!children) {
                children = new Set<string>()
                m.set(fullParent, children)
              }
              children.add(child)
            } else {
              let children = m.get(rootPath)
              if (!children) {
                children = new Set()
                m.set(rootPath, children)
              }
              children.add(d.name)
            }
            return m
          }, new Map<T.FS.Path, Set<string>>())

          const direntToPathAndPathItem = (d: T.RPCGen.Dirent) => {
            const path = T.FS.pathConcat(rootPath, d.name)
            const entry = makeEntry(d, childMap.get(path))
            if (entry.type === T.FS.PathType.Folder && isRecursive && !d.name.includes('/')) {
              // Since we are loading with a depth of 2, first level directories are
              // considered "loaded".
              return [
                path,
                {
                  ...entry,
                  progress: T.FS.ProgressType.Loaded,
                },
              ] as const
            }
            return [path, entry] as const
          }

          // Get metadata fields of the directory that we just loaded from state to
          // avoid overriding them.
          const rootPathItem = Constants.getPathItem(get().pathItems, rootPath)
          const rootFolder: T.FS.FolderPathItem = {
            ...(rootPathItem.type === T.FS.PathType.Folder
              ? rootPathItem
              : {...Constants.emptyFolder, name: T.FS.getPathName(rootPath)}),
            children: new Set(childMap.get(rootPath)),
            progress: T.FS.ProgressType.Loaded,
          }

          const pathItems = new Map<T.FS.Path, T.FS.PathItem>([
            ...(T.FS.getPathLevel(rootPath) > 2 ? [[rootPath, rootFolder] as const] : []),
            ...entries.map(direntToPathAndPathItem),
          ] as const)
          set(s => {
            pathItems.forEach((pathItemFromAction, path) => {
              const oldPathItem = Constants.getPathItem(s.pathItems, path)
              const newPathItem = updatePathItem(oldPathItem, pathItemFromAction)
              oldPathItem.type === T.FS.PathType.Folder &&
                oldPathItem.children.forEach(
                  name =>
                    (newPathItem.type !== T.FS.PathType.Folder || !newPathItem.children.has(name)) &&
                    s.pathItems.delete(T.FS.pathConcat(path, name))
                )
              s.pathItems.set(path, T.castDraft(newPathItem))
            })

            // Remove Rename edits that are for path items that don't exist anymore in
            // case when/if a new item is added later the edit causes confusion.
            const newEntries = [...s.edits.entries()].filter(([_, edit]) => {
              if (edit.type !== T.FS.EditType.Rename) {
                return true
              }
              const parent = Constants.getPathItem(s.pathItems, edit.parentPath)
              if (parent.type === T.FS.PathType.Folder && parent.children.has(edit.name)) {
                return true
              }
              return false
            })
            if (newEntries.length !== s.edits.size) {
              s.edits = new Map(newEntries)
            }
          })
        } catch (error) {
          errorToActionOrThrow(error, rootPath)
          return
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
    kbfsDaemonOnlineStatusChanged: onlineStatus => {
      set(s => {
        s.kbfsDaemonStatus.onlineStatus =
          onlineStatus === T.RPCGen.KbfsOnlineStatus.offline
            ? T.FS.KbfsDaemonOnlineStatus.Offline
            : onlineStatus === T.RPCGen.KbfsOnlineStatus.trying
              ? T.FS.KbfsDaemonOnlineStatus.Trying
              : // eslint-disable-next-line
                onlineStatus === T.RPCGen.KbfsOnlineStatus.online
                ? T.FS.KbfsDaemonOnlineStatus.Online
                : T.FS.KbfsDaemonOnlineStatus.Unknown
      })
    },
    kbfsDaemonRpcStatusChanged: rpcStatus => {
      set(s => {
        if (rpcStatus !== T.FS.KbfsDaemonRpcStatus.Connected) {
          s.kbfsDaemonStatus.onlineStatus = T.FS.KbfsDaemonOnlineStatus.Offline
        }
        s.kbfsDaemonStatus.rpcStatus = rpcStatus
      })

      const kbfsDaemonStatus = get().kbfsDaemonStatus
      if (kbfsDaemonStatus.rpcStatus !== T.FS.KbfsDaemonRpcStatus.Connected) {
        get().dispatch.setTlfsAsUnloaded()
      }

      const subscribeAndLoadFsBadge = () => {
        const oldFsBadgeSubscriptionID = fsBadgeSubscriptionID
        fsBadgeSubscriptionID = makeUUID()
        const kbfsDaemonStatus = get().kbfsDaemonStatus
        if (kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
          if (oldFsBadgeSubscriptionID) {
            get().dispatch.unsubscribe(oldFsBadgeSubscriptionID)
          }
          get().dispatch.subscribeNonPath(fsBadgeSubscriptionID, T.RPCGen.SubscriptionTopic.filesTabBadge)
          get().dispatch.loadFilesTabBadge()
        }
      }

      subscribeAndLoadFsBadge()

      const subscribeAndLoadSettings = () => {
        const oldSettingsSubscriptionID = settingsSubscriptionID
        settingsSubscriptionID = makeUUID()
        const kbfsDaemonStatus = get().kbfsDaemonStatus
        if (kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
          get().dispatch.loadSettings()
        }

        if (kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
          if (oldSettingsSubscriptionID) {
            get().dispatch.unsubscribe(oldSettingsSubscriptionID)
          }
          get().dispatch.subscribeNonPath(settingsSubscriptionID, T.RPCGen.SubscriptionTopic.settings)
        }
      }
      subscribeAndLoadSettings()

      const subscribeAndLoadUploadStatus = () => {
        const oldUploadStatusSubscriptionID = uploadStatusSubscriptionID
        uploadStatusSubscriptionID = makeUUID()
        const kbfsDaemonStatus = get().kbfsDaemonStatus

        if (kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
          get().dispatch.loadUploadStatus()
        }

        if (kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
          if (oldUploadStatusSubscriptionID) {
            get().dispatch.unsubscribe(oldUploadStatusSubscriptionID)
          }

          get().dispatch.subscribeNonPath(uploadStatusSubscriptionID, T.RPCGen.SubscriptionTopic.uploadStatus)
        }
      }
      subscribeAndLoadUploadStatus()

      const subscribeAndLoadJournalStatus = () => {
        const oldJournalStatusSubscriptionID = journalStatusSubscriptionID
        journalStatusSubscriptionID = makeUUID()
        const kbfsDaemonStatus = get().kbfsDaemonStatus
        if (kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
          if (oldJournalStatusSubscriptionID) {
            get().dispatch.unsubscribe(oldJournalStatusSubscriptionID)
          }
          get().dispatch.subscribeNonPath(
            journalStatusSubscriptionID,
            T.RPCGen.SubscriptionTopic.journalStatus
          )
          get().dispatch.pollJournalStatus()
        }
      }
      subscribeAndLoadJournalStatus()
      // how this works isn't great. This function gets called way early before we set this
      get().dispatch.defer.afterKbfsDaemonRpcStatusChanged?.()
    },
    letResetUserBackIn: (id, username) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamReAddMemberAfterResetRpcPromise({id, username})
        } catch (error) {
          errorToActionOrThrow(error)
        }
      }
      ignorePromise(f())
    },
    loadAdditionalTlf: tlfPath => {
      const f = async () => {
        if (T.FS.getPathLevel(tlfPath) !== 3) {
          logger.warn('loadAdditionalTlf called on non-TLF path')
          return
        }
        try {
          const {folder, isFavorite, isIgnored, isNew} = await T.RPCGen.SimpleFSSimpleFSGetFolderRpcPromise({
            path: Constants.pathToRPCPath(tlfPath).kbfs,
          })
          const tlfType = rpcFolderTypeToTlfType(folder.folderType)
          const tlfName =
            tlfType === T.FS.TlfType.Private || tlfType === T.FS.TlfType.Public
              ? tlfToPreferredOrder(folder.name, useCurrentUserState.getState().username)
              : folder.name

          if (tlfType) {
            set(s => {
              s.tlfs.additionalTlfs.set(
                tlfPath,
                T.castDraft(
                  makeTlf({
                    conflictState: rpcConflictStateToConflictState(folder.conflictState || undefined),
                    isFavorite,
                    isIgnored,
                    isNew,
                    name: tlfName,
                    resetParticipants: (folder.reset_members || []).map(({username}) => username),
                    syncConfig: getSyncConfigFromRPC(tlfName, tlfType, folder.syncConfig || undefined),
                    teamId: folder.team_id || '',
                    tlfMtime: folder.mtime || 0,
                  })
                )
              )
            })
          }
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (error.code === T.RPCGen.StatusCode.scteamcontactsettingsblock) {
            const fields = error.fields as undefined | Array<{key?: string; value?: string}>
            const users = fields?.filter(elem => elem.key === 'usernames')
            const usernames = users?.map(elem => elem.value ?? '') ?? []
            // Don't leave the user on a broken FS dir screen.
            navigateUp()
            navigateAppend({
              props: {source: 'newFolder', usernames},
              selected: 'contactRestricted',
            })
          }
          errorToActionOrThrow(error, tlfPath)
        }
      }
      ignorePromise(f())
    },
    loadDownloadInfo: downloadID => {
      const f = async () => {
        try {
          const res = await T.RPCGen.SimpleFSSimpleFSGetDownloadInfoRpcPromise({
            downloadID,
          })
          set(s => {
            s.downloads.info.set(downloadID, {
              filename: res.filename,
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

            const toDelete = [...s.downloads.info.keys()].filter(downloadID => !state.has(downloadID))
            if (toDelete.length) {
              toDelete.forEach(downloadID => s.downloads.info.delete(downloadID))
            }
          })
        } catch (error) {
          errorToActionOrThrow(error)
        }
      }
      ignorePromise(f())
    },
    loadFileContext: path => {
      const f = async () => {
        try {
          const res = await T.RPCGen.SimpleFSSimpleFSGetGUIFileContextRpcPromise({
            path: Constants.pathToRPCPath(path).kbfs,
          })

          set(s => {
            s.fileContext.set(path, {
              contentType: res.contentType,
              url: res.url,
              viewType: res.viewType,
            })
          })
        } catch (err) {
          errorToActionOrThrow(err)
          return
        }
      }
      ignorePromise(f())
    },
    loadFilesTabBadge: () => {
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
    },
    loadPathInfo: path => {
      const f = async () => {
        const pathInfo = await T.RPCGen.kbfsMountGetKBFSPathInfoRpcPromise({
          standardPath: T.FS.pathToString(path),
        })
        get().dispatch.loadedPathInfo(path, {
          deeplinkPath: pathInfo.deeplinkPath,
          platformAfterMountPath: pathInfo.platformAfterMountPath,
        })
      }
      ignorePromise(f())
    },
    loadPathMetadata: path => {
      const f = async () => {
        try {
          const dirent = await T.RPCGen.SimpleFSSimpleFSStatRpcPromise(
            {
              path: Constants.pathToRPCPath(path),
              refreshSubscription: false,
            },
            S.waitingKeyFSStat
          )

          const pathItem = makeEntry(dirent)
          set(s => {
            const oldPathItem = Constants.getPathItem(s.pathItems, path)
            s.pathItems.set(path, T.castDraft(updatePathItem(oldPathItem, pathItem)))
            s.softErrors.pathErrors.delete(path)
            s.softErrors.tlfErrors.delete(path)
          })
        } catch (err) {
          errorToActionOrThrow(err, path)
          return
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
    loadTlfSyncConfig: tlfPath => {
      const f = async () => {
        const parsedPath = Constants.parsePath(tlfPath)
        if (parsedPath.kind !== T.FS.PathKind.GroupTlf && parsedPath.kind !== T.FS.PathKind.TeamTlf) {
          return
        }
        try {
          const result = await T.RPCGen.SimpleFSSimpleFSFolderSyncConfigAndStatusRpcPromise({
            path: Constants.pathToRPCPath(tlfPath),
          })
          const syncConfig = getSyncConfigFromRPC(parsedPath.tlfName, parsedPath.tlfType, result.config)
          const tlfName = parsedPath.tlfName
          const tlfType = parsedPath.tlfType

          set(s => {
            const oldTlfList = s.tlfs[tlfType]
            const oldTlfFromFavorites = oldTlfList.get(tlfName) || Constants.unknownTlf
            if (oldTlfFromFavorites !== Constants.unknownTlf) {
              s.tlfs[tlfType] = T.castDraft(
                new Map([...oldTlfList, [tlfName, {...oldTlfFromFavorites, syncConfig}]])
              )
              return
            }

            const tlfPath = T.FS.pathConcat(T.FS.pathConcat(Constants.defaultPath, tlfType), tlfName)
            const oldTlfFromAdditional = s.tlfs.additionalTlfs.get(tlfPath) || Constants.unknownTlf
            if (oldTlfFromAdditional !== Constants.unknownTlf) {
              s.tlfs.additionalTlfs = T.castDraft(
                new Map([...s.tlfs.additionalTlfs, [tlfPath, {...oldTlfFromAdditional, syncConfig}]])
              )
              return
            }
          })
        } catch (e) {
          errorToActionOrThrow(e, tlfPath)
          return
        }
      }
      ignorePromise(f())
    },
    loadUploadStatus: () => {
      const f = async () => {
        try {
          const uploadStates = await T.RPCGen.SimpleFSSimpleFSGetUploadStatusRpcPromise()
          set(s => {
            // return FsGen.createLoadedUploadStatus({uploadStates: uploadStates || []})

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
    },
    loadedPathInfo: (path, info) => {
      set(s => {
        s.pathInfos.set(path, info)
      })
    },
    moveOrCopy: (destinationParentPath: T.FS.Path, type: 'move' | 'copy') => {
      const f = async () => {
        const zState = get()
        if (zState.destinationPicker.source.type === T.FS.DestinationPickerSource.None) {
          return
        }

        const params =
          zState.destinationPicker.source.type === T.FS.DestinationPickerSource.MoveOrCopy
            ? [
                {
                  dest: Constants.pathToRPCPath(
                    T.FS.pathConcat(
                      destinationParentPath,
                      T.FS.getPathName(zState.destinationPicker.source.path)
                    )
                  ),
                  opID: makeUUID(),
                  overwriteExistingFiles: false,
                  src: Constants.pathToRPCPath(zState.destinationPicker.source.path),
                },
              ]
            : zState.destinationPicker.source.source
                .map(item => ({originalPath: item.originalPath ?? '', scaledPath: item.scaledPath}))
                .filter(({originalPath}) => !!originalPath)
                .map(({originalPath, scaledPath}) => ({
                  dest: Constants.pathToRPCPath(
                    T.FS.pathConcat(
                      destinationParentPath,
                      T.FS.getLocalPathName(originalPath)
                      // We use the local path name here since we only care about file name.
                    )
                  ),
                  opID: makeUUID(),
                  overwriteExistingFiles: false,
                  src: {
                    PathType: T.RPCGen.PathType.local,
                    local: T.FS.getNormalizedLocalPath(
                      useConfigState.getState().incomingShareUseOriginal
                        ? originalPath
                        : scaledPath || originalPath
                    ),
                  } as T.RPCGen.Path,
                }))

        try {
          const rpc =
            type === 'move'
              ? T.RPCGen.SimpleFSSimpleFSMoveRpcPromise
              : T.RPCGen.SimpleFSSimpleFSCopyRecursiveRpcPromise
          await Promise.all(params.map(async p => rpc(p)))
          await Promise.all(params.map(async ({opID}) => T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID})))
          // We get source/dest paths from state rather than action, so we can't
          // just retry it. If we do want retry in the future we can include those
          // paths in the action.
        } catch (e) {
          errorToActionOrThrow(e, destinationParentPath)
          return
        }
      }
      ignorePromise(f())
    },
    newFolderRow: parentPath => {
      const parentPathItem = Constants.getPathItem(get().pathItems, parentPath)
      if (parentPathItem.type !== T.FS.PathType.Folder) {
        console.warn(`bad parentPath: ${parentPathItem.type}`)
        return
      }

      const existingNewFolderNames = new Set([...get().edits.values()].map(({name}) => name))

      let newFolderName = 'New Folder'
      let i = 2
      while (parentPathItem.children.has(newFolderName) || existingNewFolderNames.has(newFolderName)) {
        newFolderName = `New Folder ${i}`
        ++i
      }

      set(s => {
        s.edits.set(makeEditID(), {
          ...Constants.emptyNewFolder,
          name: newFolderName,
          originalName: newFolderName,
          parentPath,
        })
      })
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
        case EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged:
          get().dispatch.syncStatusChanged(action.payload.params.status)
          break
        case EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath: {
          const {clientID, path, topics} = action.payload.params
          get().dispatch.onPathChange(clientID, path, topics ?? [])
          break
        }
        case EngineGen.keybase1NotifyFSFSSubscriptionNotify: {
          const {clientID, topic} = action.payload.params
          get().dispatch.onSubscriptionNotify(clientID, topic)
          break
        }
        default:
      }
    },
    onPathChange: (cid, path, topics) => {
      if (cid !== clientID) {
        return
      }

      const {folderListLoad} = useFSState.getState().dispatch
      topics.forEach(topic => {
        switch (topic) {
          case T.RPCGen.PathSubscriptionTopic.children:
            folderListLoad(T.FS.stringToPath(path), false)
            break
          case T.RPCGen.PathSubscriptionTopic.stat:
            get().dispatch.loadPathMetadata(T.FS.stringToPath(path))
            break
        }
      })
    },
    onSubscriptionNotify: (cid, topic) => {
      const f = async () => {
        if (cid !== clientID) {
          return
        }
        switch (topic) {
          case T.RPCGen.SubscriptionTopic.favorites:
            get().dispatch.favoritesLoad()
            break
          case T.RPCGen.SubscriptionTopic.journalStatus:
            get().dispatch.pollJournalStatus()
            break
          case T.RPCGen.SubscriptionTopic.onlineStatus:
            await checkIfWeReConnectedToMDServerUpToNTimes(1)
            break
          case T.RPCGen.SubscriptionTopic.downloadStatus:
            get().dispatch.loadDownloadStatus()
            break
          case T.RPCGen.SubscriptionTopic.uploadStatus:
            get().dispatch.loadUploadStatus()
            break
          case T.RPCGen.SubscriptionTopic.filesTabBadge:
            get().dispatch.loadFilesTabBadge()
            break
          case T.RPCGen.SubscriptionTopic.settings:
            get().dispatch.loadSettings()
            break
          case T.RPCGen.SubscriptionTopic.overallSyncStatus:
            break
        }
      }
      ignorePromise(f())
    },
    pollJournalStatus: () => {
      if (pollJournalStatusPolling) {
        return
      }
      pollJournalStatusPolling = true

      const getWaitDuration = (endEstimate: number | undefined, lower: number, upper: number): number => {
        if (!endEstimate) {
          return upper
        }
        const diff = endEstimate - Date.now()
        return diff < lower ? lower : diff > upper ? upper : diff
      }

      const f = async () => {
        try {
          while (true) {
            const {syncingPaths, totalSyncingBytes, endEstimate} =
              await T.RPCGen.SimpleFSSimpleFSSyncStatusRpcPromise({
                filter: T.RPCGen.ListFilter.filterSystemHidden,
              })
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
            get().dispatch.defer.onBadgeApp?.('kbfsUploading', true)
            await timeoutPromise(getWaitDuration(endEstimate || undefined, 100, 4000)) // 0.1s to 4s
          }
        } finally {
          pollJournalStatusPolling = false
          get().dispatch.defer.onBadgeApp?.('kbfsUploading', false)
          get().dispatch.checkKbfsDaemonRpcStatus()
        }
      }
      ignorePromise(f())
    },
    redbar: error => {
      set(s => {
        s.errors.push(error)
      })
    },
    resetState: () => {
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
    setDestinationPickerParentPath: (index, path) => {
      set(s => {
        s.destinationPicker.destinationParentPath[index] = path
      })
    },
    setDirectMountDir: directMountDir => {
      set(s => {
        s.sfmi.directMountDir = directMountDir
      })
    },
    setDriverStatus: driverStatus => {
      set(s => {
        s.sfmi.driverStatus = driverStatus
      })
      get().dispatch.defer.refreshMountDirsDesktop?.()
    },
    setEditName: (editID, name) => {
      set(s => {
        const e = s.edits.get(editID)
        if (e) {
          e.name = name
        }
      })
    },
    setFolderViewFilter: filter => {
      set(s => {
        s.folderViewFilter = filter
      })
    },
    setIncomingShareSource: source => {
      set(s => {
        s.destinationPicker.source = {
          source: T.castDraft(source),
          type: T.FS.DestinationPickerSource.IncomingShare,
        }
      })
    },
    setLastPublicBannerClosedTlf: tlf => {
      set(s => {
        s.lastPublicBannerClosedTlf = tlf
      })
    },
    setMoveOrCopySource: path => {
      set(s => {
        s.destinationPicker.source = {path, type: T.FS.DestinationPickerSource.MoveOrCopy}
      })
    },
    setPathItemActionMenuDownload: (downloadID, intent) => {
      set(s => {
        s.pathItemActionMenu.downloadID = downloadID
        s.pathItemActionMenu.downloadIntent = intent
      })
    },
    setPathItemActionMenuView: view => {
      set(s => {
        s.pathItemActionMenu.previousView = s.pathItemActionMenu.view
        s.pathItemActionMenu.view = view
      })
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
    setPreferredMountDirs: preferredMountDirs => {
      set(s => {
        s.sfmi.preferredMountDirs = T.castDraft(preferredMountDirs)
      })
    },
    setSorting: (path, sortSetting) => {
      set(s => {
        const old = s.pathUserSettings.get(path)
        if (old) {
          old.sort = sortSetting
        } else {
          s.pathUserSettings.set(path, {...Constants.defaultPathUserSetting, sort: sortSetting})
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
    setTlfSyncConfig: (tlfPath, enabled) => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSSetFolderSyncConfigRpcPromise(
          {
            config: {mode: enabled ? T.RPCGen.FolderSyncMode.enabled : T.RPCGen.FolderSyncMode.disabled},
            path: Constants.pathToRPCPath(tlfPath),
          },
          S.waitingKeyFSSyncToggle
        )
        get().dispatch.loadTlfSyncConfig(tlfPath)
      }
      ignorePromise(f())
    },
    setTlfsAsUnloaded: () => {
      set(s => {
        s.tlfs.loaded = false
      })
    },
    showIncomingShare: initialDestinationParentPath => {
      set(s => {
        if (s.destinationPicker.source.type !== T.FS.DestinationPickerSource.IncomingShare) {
          s.destinationPicker.source = {source: [], type: T.FS.DestinationPickerSource.IncomingShare}
        }
        s.destinationPicker.destinationParentPath = [initialDestinationParentPath]
      })
      navigateAppend({props: {index: 0}, selected: 'destinationPicker'})
    },
    showMoveOrCopy: initialDestinationParentPath => {
      set(s => {
        s.destinationPicker.source =
          s.destinationPicker.source.type === T.FS.DestinationPickerSource.MoveOrCopy
            ? s.destinationPicker.source
            : {
                path: Constants.defaultPath,
                type: T.FS.DestinationPickerSource.MoveOrCopy,
              }

        s.destinationPicker.destinationParentPath = [initialDestinationParentPath]
      })

      navigateAppend({props: {index: 0}, selected: 'destinationPicker'})
    },
    startManualConflictResolution: tlfPath => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSClearConflictStateRpcPromise({
          path: Constants.pathToRPCPath(tlfPath),
        })
        get().dispatch.favoritesLoad()
      }
      ignorePromise(f())
    },
    startRename: path => {
      const parentPath = T.FS.getPathParent(path)
      const originalName = T.FS.getPathName(path)
      set(s => {
        s.edits.set(makeEditID(), {
          name: originalName,
          originalName,
          parentPath,
          type: T.FS.EditType.Rename,
        })
      })
    },
    subscribeNonPath: (subscriptionID, topic) => {
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
    },
    subscribePath: (subscriptionID, path, topic) => {
      const f = async () => {
        try {
          await T.RPCGen.SimpleFSSimpleFSSubscribePathRpcPromise({
            clientID,
            deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
            kbfsPath: T.FS.pathToString(path),
            subscriptionID,
            topic,
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (error.code !== T.RPCGen.StatusCode.scteamcontactsettingsblock) {
            // We'll handle this error in loadAdditionalTLF instead.
            errorToActionOrThrow(error, path)
          }
        }
      }
      ignorePromise(f())
    },
    syncStatusChanged: status => {
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
            get().dispatch.defer.onBadgeApp?.('outOfSpace', status.outOfSyncSpace)
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
    },
    unsubscribe: subscriptionID => {
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
        try {
          const writerEdits = await T.RPCGen.SimpleFSSimpleFSUserEditHistoryRpcPromise()
          set(s => {
            s.tlfUpdates = T.castDraft(userTlfHistoryRPCToState(writerEdits || []))
          })
        } catch (error) {
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
    waitForKbfsDaemon: () => {
      if (waitForKbfsDaemonInProgress) {
        return
      }
      waitForKbfsDaemonInProgress = true
      set(s => {
        s.kbfsDaemonStatus.rpcStatus = T.FS.KbfsDaemonRpcStatus.Waiting
      })
      const f = async () => {
        try {
          await T.RPCGen.configWaitForClientRpcPromise({
            clientType: T.RPCGen.ClientType.kbfs,
            timeout: 60, // 1min. This is arbitrary since we're gonna check again anyway if we're not connected.
          })
        } catch {}

        waitForKbfsDaemonInProgress = false
        get().dispatch.checkKbfsDaemonRpcStatus()
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
