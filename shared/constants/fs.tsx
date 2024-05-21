import * as C from '.'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as Tabs from './tabs'
import * as T from './types'
import * as Z from '@/util/zustand'
import NotifyPopup from '@/util/notify-popup'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import {isLinux, isMobile} from './platform'
import {tlfToPreferredOrder} from '@/util/kbfs'
import isObject from 'lodash/isObject'
import isEqual from 'lodash/isEqual'

export const syncToggleWaitingKey = 'fs:syncToggle'
export const folderListWaitingKey = 'fs:folderList'
export const statWaitingKey = 'fs:stat'
export const acceptMacOSFuseExtClosedSourceWaitingKey = 'fs:acceptMacOSFuseExtClosedSourceWaitingKey'
export const commitEditWaitingKey = 'fs:commitEditWaitingKey'
export const setSyncOnCellularWaitingKey = 'fs:setSyncOnCellular'

const subscriptionDeduplicateIntervalSecond = 1
export const defaultPath = T.FS.stringToPath('/keybase')

export const rpcFolderTypeToTlfType = (rpcFolderType: T.RPCGen.FolderType) => {
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

export const rpcConflictStateToConflictState = (
  rpcConflictState?: T.RPCGen.ConflictState
): T.FS.ConflictState => {
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
        normalViewTlfPath: nv.PathType === T.RPCGen.PathType.kbfs ? rpcPathToPath(nv.kbfs) : defaultPath,
      })
    }
  } else {
    return tlfNormalViewWithNoConflict
  }
}

export const getSyncConfigFromRPC = (
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

// See Installer.m: KBExitFuseKextError
export const ExitCodeFuseKextError = 4
// See Installer.m: KBExitFuseKextPermissionError
export const ExitCodeFuseKextPermissionError = 5
// See Installer.m: KBExitAuthCanceledError
export const ExitCodeAuthCanceledError = 6

export const emptyNewFolder: T.FS.Edit = {
  error: undefined,
  name: 'New Folder',
  originalName: 'New Folder',
  parentPath: T.FS.stringToPath('/keybase'),
  type: T.FS.EditType.NewFolder,
}

export const prefetchNotStarted: T.FS.PrefetchNotStarted = {
  state: T.FS.PrefetchState.NotStarted,
}

export const prefetchComplete: T.FS.PrefetchComplete = {
  state: T.FS.PrefetchState.Complete,
}

export const emptyPrefetchInProgress: T.FS.PrefetchInProgress = {
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  startTime: 0,
  state: T.FS.PrefetchState.InProgress,
}

const pathItemMetadataDefault = {
  lastModifiedTimestamp: 0,
  lastWriter: '',
  name: 'unknown',
  prefetchStatus: prefetchNotStarted,
  size: 0,
  writable: false,
}

export const emptyFolder: T.FS.FolderPathItem = {
  ...pathItemMetadataDefault,
  children: new Set(),
  progress: T.FS.ProgressType.Pending,
  type: T.FS.PathType.Folder,
}

export const emptyFile: T.FS.FilePathItem = {
  ...pathItemMetadataDefault,
  type: T.FS.PathType.File,
}

export const emptySymlink: T.FS.SymlinkPathItem = {
  ...pathItemMetadataDefault,
  linkTarget: '',
  type: T.FS.PathType.Symlink,
}

export const unknownPathItem: T.FS.UnknownPathItem = {
  ...pathItemMetadataDefault,
  type: T.FS.PathType.Unknown,
}

export const tlfSyncEnabled: T.FS.TlfSyncEnabled = {
  mode: T.FS.TlfSyncMode.Enabled,
}

export const tlfSyncDisabled: T.FS.TlfSyncDisabled = {
  mode: T.FS.TlfSyncMode.Disabled,
}

export const makeTlfSyncPartial = ({
  enabledPaths,
}: {
  enabledPaths?: T.FS.TlfSyncPartial['enabledPaths']
}): T.FS.TlfSyncPartial => ({
  enabledPaths: [...(enabledPaths || [])],
  mode: T.FS.TlfSyncMode.Partial,
})

export const makeConflictStateNormalView = ({
  localViewTlfPaths,
  resolvingConflict,
  stuckInConflict,
}: Partial<T.FS.ConflictStateNormalView>): T.FS.ConflictStateNormalView => ({
  localViewTlfPaths: [...(localViewTlfPaths || [])],
  resolvingConflict: resolvingConflict || false,
  stuckInConflict: stuckInConflict || false,
  type: T.FS.ConflictStateType.NormalView,
})

export const tlfNormalViewWithNoConflict = makeConflictStateNormalView({})

export const makeConflictStateManualResolvingLocalView = ({
  normalViewTlfPath,
}: Partial<T.FS.ConflictStateManualResolvingLocalView>): T.FS.ConflictStateManualResolvingLocalView => ({
  normalViewTlfPath: normalViewTlfPath || defaultPath,
  type: T.FS.ConflictStateType.ManualResolvingLocalView,
})

export const makeTlf = (p: Partial<T.FS.Tlf>): T.FS.Tlf => {
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

export const emptySyncingFoldersProgress: T.FS.SyncingFoldersProgress = {
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  start: 0,
}

export const emptyOverallSyncStatus: T.FS.OverallSyncStatus = {
  diskSpaceStatus: T.FS.DiskSpaceStatus.Ok,
  showingBanner: false,
  syncingFoldersProgress: emptySyncingFoldersProgress,
}

export const defaultPathUserSetting: T.FS.PathUserSetting = {
  sort: T.FS.SortSetting.NameAsc,
}

export const defaultTlfListPathUserSetting: T.FS.PathUserSetting = {
  sort: T.FS.SortSetting.TimeAsc,
}

export const emptyDownloadState: T.FS.DownloadState = {
  canceled: false,
  done: false,
  endEstimate: 0,
  error: '',
  localPath: '',
  progress: 0,
}

export const emptyDownloadInfo: T.FS.DownloadInfo = {
  filename: '',
  isRegularDownload: false,
  path: defaultPath,
  startTime: 0,
}

export const emptyPathItemActionMenu: T.FS.PathItemActionMenu = {
  downloadID: undefined,
  downloadIntent: undefined,
  previousView: T.FS.PathItemActionMenuView.Root,
  view: T.FS.PathItemActionMenuView.Root,
}

export const driverStatusUnknown: T.FS.DriverStatusUnknown = {
  type: T.FS.DriverStatusType.Unknown,
} as const

export const emptyDriverStatusEnabled: T.FS.DriverStatusEnabled = {
  dokanOutdated: false,
  dokanUninstallExecPath: undefined,
  isDisabling: false,
  type: T.FS.DriverStatusType.Enabled,
} as const

export const emptyDriverStatusDisabled: T.FS.DriverStatusDisabled = {
  isEnabling: false,
  kextPermissionError: false,
  type: T.FS.DriverStatusType.Disabled,
} as const

export const defaultDriverStatus: T.FS.DriverStatus = isLinux ? emptyDriverStatusEnabled : driverStatusUnknown

export const unknownKbfsDaemonStatus: T.FS.KbfsDaemonStatus = {
  onlineStatus: T.FS.KbfsDaemonOnlineStatus.Unknown,
  rpcStatus: T.FS.KbfsDaemonRpcStatus.Waiting,
}

export const emptySettings: T.FS.Settings = {
  isLoading: false,
  loaded: false,
  sfmiBannerDismissed: false,
  spaceAvailableNotificationThreshold: 0,
  syncOnCellular: false,
}

export const emptyPathInfo: T.FS.PathInfo = {
  deeplinkPath: '',
  platformAfterMountPath: '',
}

export const emptyFileContext: T.FS.FileContext = {
  contentType: '',
  url: '',
  viewType: T.RPCGen.GUIViewType.default,
}

export const getPathItem = (
  pathItems: T.Immutable<Map<T.FS.Path, T.FS.PathItem>>,
  path: T.Immutable<T.FS.Path>
): T.Immutable<T.FS.PathItem> => pathItems.get(path) || (unknownPathItem as T.FS.PathItem)

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
export const pathToRPCPath = (
  path: T.FS.Path
): {PathType: T.RPCGen.PathType.kbfs; kbfs: T.RPCGen.KBFSPath} => ({
  PathType: T.RPCGen.PathType.kbfs,
  kbfs: {
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
    path: T.FS.pathToString(path).substring('/keybase'.length) || '/',
  },
})

export const rpcPathToPath = (rpcPath: T.RPCGen.KBFSPath) => T.FS.pathConcat(defaultPath, rpcPath.path)

export const pathTypeToTextType = (type: T.FS.PathType) =>
  type === T.FS.PathType.Folder ? 'BodySemibold' : 'Body'

export const splitTlfIntoUsernames = (tlf: string): ReadonlyArray<string> =>
  tlf.split(' ')[0]?.replace(/#/g, ',').split(',') ?? []

export const getUsernamesFromPath = (path: T.FS.Path): ReadonlyArray<string> => {
  const elems = T.FS.getPathElements(path)
  return elems.length < 3 ? [] : splitTlfIntoUsernames(elems[2]!)
}

export const humanReadableFileSize = (size: number) => {
  const kib = 1024
  const mib = kib * kib
  const gib = mib * kib
  const tib = gib * kib

  if (!size) return ''
  if (size >= tib) return `${Math.round(size / tib)} TB`
  if (size >= gib) return `${Math.round(size / gib)} GB`
  if (size >= mib) return `${Math.round(size / mib)} MB`
  if (size >= kib) return `${Math.round(size / kib)} KB`
  return `${size} B`
}

export const downloadIsOngoing = (dlState: T.FS.DownloadState) =>
  dlState !== emptyDownloadState && !dlState.error && !dlState.done && !dlState.canceled

export const getDownloadIntent = (
  path: T.FS.Path,
  downloads: T.FS.Downloads,
  pathItemActionMenu: T.FS.PathItemActionMenu
): T.FS.DownloadIntent | undefined => {
  const found = [...downloads.info].find(([_, info]) => info.path === path)
  if (!found) {
    return undefined
  }
  const [downloadID] = found
  const dlState = downloads.state.get(downloadID) || emptyDownloadState
  if (!downloadIsOngoing(dlState)) {
    return undefined
  }
  if (pathItemActionMenu.downloadID === downloadID) {
    return pathItemActionMenu.downloadIntent
  }
  return T.FS.DownloadIntent.None
}

export const emptyTlfUpdate: T.FS.TlfUpdate = {
  history: [],
  path: T.FS.stringToPath(''),
  serverTime: 0,
  writer: '',
}

export const emptyTlfEdit: T.FS.TlfEdit = {
  editType: T.FS.FileEditType.Unknown,
  filename: '',
  serverTime: 0,
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

export const userTlfHistoryRPCToState = (
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

export const canSaveMedia = (pathItem: T.FS.PathItem, fileContext: T.FS.FileContext): boolean => {
  if (pathItem.type !== T.FS.PathType.File || fileContext === emptyFileContext) {
    return false
  }
  return (
    fileContext.viewType === T.RPCGen.GUIViewType.image || fileContext.viewType === T.RPCGen.GUIViewType.video
  )
}

export const folderRPCFromPath = (path: T.FS.Path): T.RPCGen.FolderHandle | undefined => {
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

export const pathFromFolderRPC = (folder: T.RPCGen.Folder): T.FS.Path => {
  const visibility = T.FS.getVisibilityFromRPCFolderType(folder.folderType)
  if (!visibility) return T.FS.stringToPath('')
  return T.FS.stringToPath(`/keybase/${visibility}/${folder.name}`)
}

export const showIgnoreFolder = (path: T.FS.Path, username?: string): boolean => {
  const elems = T.FS.getPathElements(path)
  if (elems.length !== 3) {
    return false
  }
  return ['public', 'private'].includes(elems[1]!) && elems[2]! !== username
}

export const syntheticEventToTargetRect = (evt?: React.SyntheticEvent): DOMRect | undefined =>
  isMobile ? undefined : evt ? (evt.target as HTMLElement).getBoundingClientRect() : undefined

export const invalidTokenError = new Error('invalid token')
export const notFoundError = new Error('not found')

export const makeEditID = (): T.FS.EditID => T.FS.stringToEditID(makeUUID())

export const getTlfListFromType = (
  tlfs: T.Immutable<T.FS.Tlfs>,
  tlfType: T.Immutable<T.FS.TlfType>
): T.Immutable<T.FS.TlfList> => {
  switch (tlfType) {
    case T.FS.TlfType.Private:
      return tlfs.private
    case T.FS.TlfType.Public:
      return tlfs.public
    case T.FS.TlfType.Team:
      return tlfs.team
    default:
      return new Map()
  }
}

export const computeBadgeNumberForTlfList = (tlfList: T.Immutable<T.FS.TlfList>): number =>
  [...tlfList.values()].reduce((accumulator, tlf) => (tlfIsBadged(tlf) ? accumulator + 1 : accumulator), 0)

export const computeBadgeNumberForAll = (tlfs: T.Immutable<T.FS.Tlfs>): number =>
  [T.FS.TlfType.Private, T.FS.TlfType.Public, T.FS.TlfType.Team]
    .map(tlfType => computeBadgeNumberForTlfList(getTlfListFromType(tlfs, tlfType)))
    .reduce((sum, count) => sum + count, 0)

export const getTlfPath = (path: T.FS.Path): T.FS.Path => {
  const elems = T.FS.getPathElements(path)
  return elems.length > 2 ? T.FS.pathConcat(T.FS.pathConcat(defaultPath, elems[1]!), elems[2]!) : undefined
}

export const getTlfListAndTypeFromPath = (
  tlfs: T.Immutable<T.FS.Tlfs>,
  path: T.Immutable<T.FS.Path>
): T.Immutable<{
  tlfList: T.FS.TlfList
  tlfType: T.FS.TlfType
}> => {
  const visibility = T.FS.getPathVisibility(path)
  switch (visibility) {
    case T.FS.TlfType.Private:
    case T.FS.TlfType.Public:
    case T.FS.TlfType.Team: {
      const tlfType: T.FS.TlfType = visibility
      return {tlfList: getTlfListFromType(tlfs, tlfType), tlfType}
    }
    default:
      return {tlfList: new Map(), tlfType: T.FS.TlfType.Private}
  }
}

export const unknownTlf = makeTlf({})
export const getTlfFromPathInFavoritesOnly = (tlfs: T.Immutable<T.FS.Tlfs>, path: T.FS.Path): T.FS.Tlf => {
  const elems = T.FS.getPathElements(path)
  if (elems.length < 3) {
    return unknownTlf
  }
  const {tlfList} = getTlfListAndTypeFromPath(tlfs, path)
  return tlfList.get(elems[2]!) || unknownTlf
}

export const getTlfFromPath = (tlfs: T.Immutable<T.FS.Tlfs>, path: T.FS.Path): T.FS.Tlf => {
  const fromFavorites = getTlfFromPathInFavoritesOnly(tlfs, path)
  return fromFavorites !== unknownTlf
    ? fromFavorites
    : tlfs.additionalTlfs.get(getTlfPath(path)) || unknownTlf
}

export const getTlfFromTlfs = (tlfs: T.FS.Tlfs, tlfType: T.FS.TlfType, name: string): T.FS.Tlf => {
  switch (tlfType) {
    case T.FS.TlfType.Private:
      return tlfs.private.get(name) || unknownTlf
    case T.FS.TlfType.Public:
      return tlfs.public.get(name) || unknownTlf
    case T.FS.TlfType.Team:
      return tlfs.team.get(name) || unknownTlf
    default:
      return unknownTlf
  }
}

export const tlfTypeAndNameToPath = (tlfType: T.FS.TlfType, name: string): T.FS.Path =>
  T.FS.stringToPath(`/keybase/${tlfType}/${name}`)

export const resetBannerType = (s: State, path: T.FS.Path): T.FS.ResetBannerType => {
  const resetParticipants = getTlfFromPath(s.tlfs, path).resetParticipants
  if (resetParticipants.length === 0) {
    return T.FS.ResetBannerNoOthersType.None
  }

  const you = C.useCurrentUserState.getState().username
  if (resetParticipants.findIndex(username => username === you) >= 0) {
    return T.FS.ResetBannerNoOthersType.Self
  }
  return resetParticipants.length
}

export const getUploadedPath = (parentPath: T.FS.Path, localPath: string) =>
  T.FS.pathConcat(parentPath, T.FS.getLocalPathName(localPath))

export const usernameInPath = (username: string, path: T.FS.Path) => {
  const elems = T.FS.getPathElements(path)
  return elems.length >= 3 && elems[2]!.split(',').includes(username)
}

export const getUsernamesFromTlfName = (tlfName: string): Array<string> => {
  const split = splitTlfIntoReadersAndWriters(tlfName)
  return split.writers.concat(split.readers || [])
}

export const isOfflineUnsynced = (
  daemonStatus: T.FS.KbfsDaemonStatus,
  pathItem: T.FS.PathItem,
  path: T.FS.Path
) =>
  daemonStatus.onlineStatus === T.FS.KbfsDaemonOnlineStatus.Offline &&
  T.FS.getPathLevel(path) > 2 &&
  pathItem.prefetchStatus !== prefetchComplete

// To make sure we have consistent badging, all badging related stuff should go
// through this function. That is:
// * When calculating number of TLFs being badged, a TLF should be counted if
//   and only if this function returns true.
// * When an individual TLF is shown (e.g. as a row), it should be badged if
//   and only if this funciton returns true.
//
// If we add more badges, this function should be updated.
export const tlfIsBadged = (tlf: T.FS.Tlf) => !tlf.isIgnored && tlf.isNew

export const pathsInSameTlf = (a: T.FS.Path, b: T.FS.Path): boolean => {
  const elemsA = T.FS.getPathElements(a)
  const elemsB = T.FS.getPathElements(b)
  return elemsA.length >= 3 && elemsB.length >= 3 && elemsA[1] === elemsB[1] && elemsA[2] === elemsB[2]
}

const slashKeybaseSlashLength = '/keybase/'.length
// TODO: move this to Go
export const escapePath = (path: T.FS.Path): string =>
  'keybase://' +
  encodeURIComponent(T.FS.pathToString(path).slice(slashKeybaseSlashLength)).replace(
    // We need to do this because otherwise encodeURIComponent would encode
    // "/"s.
    /%2F/g,
    '/'
  )

export const parsedPathRoot: T.FS.ParsedPathRoot = {kind: T.FS.PathKind.Root}

export const parsedPathPrivateList: T.FS.ParsedPathTlfList = {
  kind: T.FS.PathKind.TlfList,
  tlfType: T.FS.TlfType.Private,
}

export const parsedPathPublicList: T.FS.ParsedPathTlfList = {
  kind: T.FS.PathKind.TlfList,
  tlfType: T.FS.TlfType.Public,
}

export const parsedPathTeamList: T.FS.ParsedPathTlfList = {
  kind: T.FS.PathKind.TlfList,
  tlfType: T.FS.TlfType.Team,
}

const splitTlfIntoReadersAndWriters = (
  tlf: string
): {
  readers?: Array<string>
  writers: Array<string>
} => {
  const [w, r] = tlf.split('#')
  return {
    readers: r ? r.split(',').filter(i => !!i) : undefined,
    writers: w?.split(',').filter(i => !!i) ?? [],
  }
}

// returns parsedPathRoot if unknown
export const parsePath = (path: T.FS.Path): T.FS.ParsedPath => {
  const elems = T.FS.getPathElements(path)
  if (elems.length <= 1) {
    return parsedPathRoot
  }
  switch (elems[1]) {
    case 'private':
      switch (elems.length) {
        case 2:
          return parsedPathPrivateList
        case 3:
          return {
            kind: T.FS.PathKind.GroupTlf,
            tlfName: elems[2]!,
            tlfType: T.FS.TlfType.Private,
            ...splitTlfIntoReadersAndWriters(elems[2]!),
          }
        default:
          return {
            kind: T.FS.PathKind.InGroupTlf,
            rest: elems.slice(3),
            tlfName: elems[2] ?? '',
            tlfType: T.FS.TlfType.Private,
            ...splitTlfIntoReadersAndWriters(elems[2] ?? ''),
          }
      }
    case 'public':
      switch (elems.length) {
        case 2:
          return parsedPathPublicList
        case 3:
          return {
            kind: T.FS.PathKind.GroupTlf,
            tlfName: elems[2]!,
            tlfType: T.FS.TlfType.Public,
            ...splitTlfIntoReadersAndWriters(elems[2]!),
          }
        default:
          return {
            kind: T.FS.PathKind.InGroupTlf,
            rest: elems.slice(3),
            tlfName: elems[2] ?? '',
            tlfType: T.FS.TlfType.Public,
            ...splitTlfIntoReadersAndWriters(elems[2] ?? ''),
          }
      }
    case 'team':
      switch (elems.length) {
        case 2:
          return parsedPathTeamList
        case 3:
          return {
            kind: T.FS.PathKind.TeamTlf,
            team: elems[2]!,
            tlfName: elems[2]!,
            tlfType: T.FS.TlfType.Team,
          }
        default:
          return {
            kind: T.FS.PathKind.InTeamTlf,
            rest: elems.slice(3),
            team: elems[2] ?? '',
            tlfName: elems[2] ?? '',
            tlfType: T.FS.TlfType.Team,
          }
      }
    default:
      return parsedPathRoot
  }
}

export const rebasePathToDifferentTlf = (path: T.FS.Path, newTlfPath: T.FS.Path) =>
  T.FS.pathConcat(newTlfPath, T.FS.getPathElements(path).slice(3).join('/'))

export const canChat = (path: T.FS.Path) => {
  const parsedPath = parsePath(path)
  switch (parsedPath.kind) {
    case T.FS.PathKind.Root:
    case T.FS.PathKind.TlfList:
      return false
    case T.FS.PathKind.GroupTlf:
    case T.FS.PathKind.TeamTlf:
      return true
    case T.FS.PathKind.InGroupTlf:
    case T.FS.PathKind.InTeamTlf:
      return true
    default:
      return false
  }
}

export const isTeamPath = (path: T.FS.Path): boolean => {
  const parsedPath = parsePath(path)
  return parsedPath.kind !== T.FS.PathKind.Root && parsedPath.tlfType === T.FS.TlfType.Team
}

export const getChatTarget = (path: T.FS.Path, me: string): string => {
  const parsedPath = parsePath(path)
  if (parsedPath.kind !== T.FS.PathKind.Root && parsedPath.tlfType === T.FS.TlfType.Team) {
    return 'team conversation'
  }
  if (parsedPath.kind === T.FS.PathKind.GroupTlf || parsedPath.kind === T.FS.PathKind.InGroupTlf) {
    if (parsedPath.writers.length === 1 && !parsedPath.readers && parsedPath.writers[0] === me) {
      return 'yourself'
    }
    if (parsedPath.writers.length + (parsedPath.readers ? parsedPath.readers.length : 0) === 2) {
      const notMe = parsedPath.writers.concat(parsedPath.readers || []).filter(u => u !== me)
      if (notMe.length === 1) {
        return notMe[0]!
      }
    }
    return 'group conversation'
  }
  return 'conversation'
}

export const getSharePathArrayDescription = (paths: ReadonlyArray<T.FS.LocalPath>): string => {
  return !paths.length ? '' : paths.length === 1 ? T.FS.getPathName(paths[0]) : `${paths.length} items`
}

export const getDestinationPickerPathName = (picker: T.FS.DestinationPicker): string =>
  picker.source.type === T.FS.DestinationPickerSource.MoveOrCopy
    ? T.FS.getPathName(picker.source.path)
    : picker.source.type === T.FS.DestinationPickerSource.IncomingShare
      ? getSharePathArrayDescription(
          picker.source.source
            .map(({originalPath}) => (originalPath ? T.FS.getLocalPathName(originalPath) : ''))
            .filter(Boolean)
        )
      : ''

const isPathEnabledForSync = (syncConfig: T.FS.TlfSyncConfig, path: T.FS.Path): boolean => {
  switch (syncConfig.mode) {
    case T.FS.TlfSyncMode.Disabled:
      return false
    case T.FS.TlfSyncMode.Enabled:
      return true
    case T.FS.TlfSyncMode.Partial:
      // TODO: when we enable partial sync lookup, remember to deal with
      // potential ".." traversal as well.
      return syncConfig.enabledPaths.includes(path)
    default:
      return false
  }
}

export const getUploadIconForTlfType = (
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus,
  uploads: T.FS.Uploads,
  tlfList: T.FS.TlfList,
  tlfType: T.FS.TlfType
): T.FS.UploadIcon | undefined => {
  if (
    [...tlfList].some(
      ([_, tlf]) =>
        tlf.conflictState.type === T.FS.ConflictStateType.NormalView && tlf.conflictState.stuckInConflict
    )
  ) {
    return T.FS.UploadIcon.UploadingStuck
  }

  const prefix = T.FS.pathToString(T.FS.getTlfTypePathFromTlfType(tlfType))
  if (
    [...uploads.syncingPaths].some(p => T.FS.pathToString(p).startsWith(prefix)) ||
    [...uploads.writingToJournal.keys()].some(p => T.FS.pathToString(p).startsWith(prefix))
  ) {
    return kbfsDaemonStatus.onlineStatus === T.FS.KbfsDaemonOnlineStatus.Offline
      ? T.FS.UploadIcon.AwaitingToUpload
      : T.FS.UploadIcon.Uploading
  }

  return undefined
}

export const tlfIsStuckInConflict = (tlf: T.FS.Tlf) =>
  tlf.conflictState.type === T.FS.ConflictStateType.NormalView && tlf.conflictState.stuckInConflict

export const getPathStatusIconInMergeProps = (
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus,
  tlf: T.Immutable<T.FS.Tlf>,
  pathItem: T.Immutable<T.FS.PathItem>,
  uploadingPaths: T.Immutable<Set<T.FS.Path>>,
  path: T.Immutable<T.FS.Path>
): T.FS.PathStatusIcon => {
  // There's no upload or sync for local conflict view.
  if (tlf.conflictState.type === T.FS.ConflictStateType.ManualResolvingLocalView) {
    return T.FS.LocalConflictStatus
  }

  // uploading state has higher priority
  if (uploadingPaths.has(path)) {
    // eslint-disable-next-line
    return tlf.conflictState.type === T.FS.ConflictStateType.NormalView && tlf.conflictState.stuckInConflict
      ? T.FS.UploadIcon.UploadingStuck
      : kbfsDaemonStatus.onlineStatus === T.FS.KbfsDaemonOnlineStatus.Offline
        ? T.FS.UploadIcon.AwaitingToUpload
        : T.FS.UploadIcon.Uploading
  }
  if (!isPathEnabledForSync(tlf.syncConfig, path)) {
    return T.FS.NonUploadStaticSyncStatus.OnlineOnly
  }

  if (pathItem === unknownPathItem && tlf.syncConfig.mode !== T.FS.TlfSyncMode.Disabled) {
    return T.FS.NonUploadStaticSyncStatus.Unknown
  }

  // TODO: what about 'sync-error'?

  // We don't have an upload state, and sync is enabled for this path.
  switch (pathItem.prefetchStatus.state) {
    case T.FS.PrefetchState.NotStarted:
      return T.FS.NonUploadStaticSyncStatus.AwaitingToSync
    case T.FS.PrefetchState.Complete:
      return T.FS.NonUploadStaticSyncStatus.Synced
    case T.FS.PrefetchState.InProgress: {
      if (kbfsDaemonStatus.onlineStatus === T.FS.KbfsDaemonOnlineStatus.Offline) {
        return T.FS.NonUploadStaticSyncStatus.AwaitingToSync
      }
      const inProgress: T.FS.PrefetchInProgress = pathItem.prefetchStatus
      if (inProgress.bytesTotal === 0) {
        return T.FS.NonUploadStaticSyncStatus.AwaitingToSync
      }
      return inProgress.bytesFetched / inProgress.bytesTotal
    }
    default:
      return T.FS.NonUploadStaticSyncStatus.Unknown
  }
}

export const makeActionsForDestinationPickerOpen = (index: number, path: T.FS.Path) => {
  _useState.getState().dispatch.setDestinationPickerParentPath(index, path)
  C.useRouterState.getState().dispatch.navigateAppend({props: {index}, selected: 'destinationPicker'})
}

export const fsRootRouteForNav1 = isMobile ? [Tabs.settingsTab, C.Settings.settingsFsTab] : [Tabs.fsTab]

export const makeActionForOpenPathInFilesTab = (
  // TODO: remove the second arg when we are done with migrating to nav2
  path: T.FS.Path
) => {
  C.useRouterState.getState().dispatch.navigateAppend({props: {path}, selected: 'fsRoot'})
}

export const getMainBannerType = (
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus,
  overallSyncStatus: T.FS.OverallSyncStatus
): T.FS.MainBannerType => {
  if (kbfsDaemonStatus.onlineStatus === T.FS.KbfsDaemonOnlineStatus.Offline) {
    return T.FS.MainBannerType.Offline
  } else if (kbfsDaemonStatus.onlineStatus === T.FS.KbfsDaemonOnlineStatus.Trying) {
    return T.FS.MainBannerType.TryingToConnect
  } else if (overallSyncStatus.diskSpaceStatus === T.FS.DiskSpaceStatus.Error) {
    return T.FS.MainBannerType.OutOfSpace
  } else {
    return T.FS.MainBannerType.None
  }
}

export const isFolder = (path: T.FS.Path, pathItem: T.FS.PathItem) =>
  T.FS.getPathLevel(path) <= 3 || pathItem.type === T.FS.PathType.Folder

export const isInTlf = (path: T.FS.Path) => T.FS.getPathLevel(path) > 2

export const humanizeBytes = (n: number, numDecimals: number): string => {
  const kb = 1024
  const mb = kb * 1024
  const gb = mb * 1024

  if (n < kb) {
    return `${n} bytes`
  } else if (n < mb) {
    return `${(n / kb).toFixed(numDecimals)} KB`
  } else if (n < gb) {
    return `${(n / mb).toFixed(numDecimals)} MB`
  }
  return `${(n / gb).toFixed(numDecimals)} GB`
}

export const humanizeBytesOfTotal = (n: number, d: number): string => {
  const kb = 1024
  const mb = kb * 1024
  const gb = mb * 1024

  if (d < kb) {
    return `${n} of ${d} bytes`
  } else if (d < mb) {
    return `${(n / kb).toFixed(2)} of ${(d / kb).toFixed(2)} KB`
  } else if (d < gb) {
    return `${(n / mb).toFixed(2)} of ${(d / mb).toFixed(2)} MB`
  }
  return `${(n / gb).toFixed(2)} of ${(d / gb).toFixed(2)} GB`
}

export const hasPublicTag = (path: T.FS.Path): boolean => {
  const publicPrefix = '/keybase/public/'
  // The slash after public in `publicPrefix` prevents /keybase/public from counting.
  return T.FS.pathToString(path).startsWith(publicPrefix)
}

export const getPathUserSetting = (
  pathUserSettings: T.Immutable<Map<T.FS.Path, T.FS.PathUserSetting>>,
  path: T.Immutable<T.FS.Path>
): T.FS.PathUserSetting =>
  pathUserSettings.get(path) ||
  (T.FS.getPathLevel(path) < 3 ? defaultTlfListPathUserSetting : defaultPathUserSetting)

export const showSortSetting = (
  path: T.FS.Path,
  pathItem: T.FS.PathItem,
  kbfsDaemonStatus: T.FS.KbfsDaemonStatus
) =>
  !isMobile &&
  path !== defaultPath &&
  (T.FS.getPathLevel(path) === 2 || (pathItem.type === T.FS.PathType.Folder && !!pathItem.children.size)) &&
  !isOfflineUnsynced(kbfsDaemonStatus, pathItem, path)

export const getSoftError = (softErrors: T.FS.SoftErrors, path: T.FS.Path): T.FS.SoftError | undefined => {
  const pathError = softErrors.pathErrors.get(path)
  if (pathError) {
    return pathError
  }
  if (!softErrors.tlfErrors.size) {
    return undefined
  }
  const tlfPath = getTlfPath(path)
  return (tlfPath && softErrors.tlfErrors.get(tlfPath)) || undefined
}

export const hasSpecialFileElement = (path: T.FS.Path): boolean =>
  T.FS.getPathElements(path).some(elem => elem.startsWith('.kbfs'))

export const sfmiInfoLoaded = (settings: T.FS.Settings, driverStatus: T.FS.DriverStatus): boolean =>
  settings.loaded && driverStatus !== driverStatusUnknown

// This isn't perfect since it doesn't cover the case of multi-writer public
// TLFs or where a team TLF is readonly to the user. But to do that we'd need
// some new caching in KBFS to plumb it into the Tlfs structure without
// awful overhead.
export const hideOrDisableInDestinationPicker = (
  tlfType: T.FS.TlfType,
  name: string,
  username: string,
  destinationPickerIndex?: number
) => typeof destinationPickerIndex === 'number' && tlfType === T.FS.TlfType.Public && name !== username

const noAccessErrorCodes: Array<T.RPCGen.StatusCode> = [
  T.RPCGen.StatusCode.scsimplefsnoaccess,
  T.RPCGen.StatusCode.scteamnotfound,
  T.RPCGen.StatusCode.scteamreaderror,
]

export const errorToActionOrThrow = (error: unknown, path?: T.FS.Path) => {
  if (!isObject(error)) return
  const code = (error as {code?: T.RPCGen.StatusCode}).code
  if (code === T.RPCGen.StatusCode.sckbfsclienttimeout) {
    _useState.getState().dispatch.checkKbfsDaemonRpcStatus()
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
    _useState.getState().dispatch.setPathSoftError(path, T.FS.SoftError.Nonexistent)
    return
  }
  if (path && code && noAccessErrorCodes.includes(code)) {
    const tlfPath = getTlfPath(path)
    if (tlfPath) {
      _useState.getState().dispatch.setTlfSoftError(tlfPath, T.FS.SoftError.NoAccess)
      return
    }
  }
  if (code === T.RPCGen.StatusCode.scdeleted) {
    // The user is deleted. Let user know and move on.
    _useState.getState().dispatch.redbar('A user in this shared folder has deleted their account.')
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
  kbfsDaemonStatus: unknownKbfsDaemonStatus,
  lastPublicBannerClosedTlf: '',
  overallSyncStatus: emptyOverallSyncStatus,
  pathInfos: new Map(),
  pathItemActionMenu: emptyPathItemActionMenu,
  pathItems: new Map(),
  pathUserSettings: new Map(),
  settings: emptySettings,
  sfmi: {
    directMountDir: '',
    driverStatus: defaultDriverStatus,
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

interface State extends Store {
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
    dynamic: {
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
    onEngineIncoming: (action: EngineGen.Actions) => void
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
    setupSubscriptions: () => void
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

const getPrefetchStatusFromRPC = (
  prefetchStatus: T.RPCGen.PrefetchStatus,
  prefetchProgress: T.RPCGen.PrefetchProgress
) => {
  switch (prefetchStatus) {
    case T.RPCGen.PrefetchStatus.notStarted:
      return prefetchNotStarted
    case T.RPCGen.PrefetchStatus.inProgress:
      return {
        ...emptyPrefetchInProgress,
        bytesFetched: prefetchProgress.bytesFetched,
        bytesTotal: prefetchProgress.bytesTotal,
        endEstimate: prefetchProgress.endEstimate,
        startTime: prefetchProgress.start,
      }
    case T.RPCGen.PrefetchStatus.complete:
      return prefetchComplete
    default:
      return prefetchNotStarted
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
        ...emptyFolder,
        ...direntToMetadata(d),
        children: new Set(children || []),
        progress: children ? T.FS.ProgressType.Loaded : T.FS.ProgressType.Pending,
      } as T.FS.PathItem
    case T.RPCGen.DirentType.sym:
      return {
        ...emptySymlink,
        ...direntToMetadata(d),
        // TODO: plumb link target
      } as T.FS.PathItem
    case T.RPCGen.DirentType.file:
    case T.RPCGen.DirentType.exec:
      return {
        ...emptyFile,
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

export const _useState = Z.createZustand<State>((set, get) => {
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
        await C.timeoutPromise(2000)
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
      C.ignorePromise(f())
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
      C.ignorePromise(f())
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
                  dest: pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.name)),
                  flags: T.RPCGen.OpenFlags.directory,
                  opID: makeUUID(),
                },
                commitEditWaitingKey
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
                dest: pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.name)),
                opID,
                overwriteExistingFiles: false,
                src: pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.originalName)),
              })
              await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID}, commitEditWaitingKey)
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
      C.ignorePromise(f())
    },
    deleteFile: path => {
      const f = async () => {
        const opID = makeUUID()
        try {
          await T.RPCGen.SimpleFSSimpleFSRemoveRpcPromise({
            opID,
            path: pathToRPCPath(path),
            recursive: true,
          })
          await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID})
        } catch (e) {
          errorToActionOrThrow(e, path)
        }
      }
      C.ignorePromise(f())
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
      C.ignorePromise(f())
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
      C.ignorePromise(f())
    },
    download: (path, type) => {
      const f = async () => {
        await C.PlatformSpecific.requestPermissionsToWrite()
        const downloadID = await T.RPCGen.SimpleFSSimpleFSStartDownloadRpcPromise({
          isRegularDownload: type === 'download',
          path: pathToRPCPath(path).kbfs,
        })
        if (type !== 'download') {
          get().dispatch.setPathItemActionMenuDownload(
            downloadID,
            type === 'share' ? T.FS.DownloadIntent.Share : T.FS.DownloadIntent.CameraRoll
          )
        }
      }
      C.ignorePromise(f())
    },
    driverDisable: () => {
      get().dispatch.dynamic.afterDriverDisable?.()
    },
    driverDisabling: () => {
      set(s => {
        if (s.sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled) {
          s.sfmi.driverStatus.isDisabling = true
        }
      })
      get().dispatch.dynamic.afterDriverDisabling?.()
    },
    driverEnable: isRetry => {
      set(s => {
        if (s.sfmi.driverStatus.type === T.FS.DriverStatusType.Disabled) {
          s.sfmi.driverStatus.isEnabling = true
        }
      })
      get().dispatch.dynamic.afterDriverEnabled?.(!!isRetry)
    },
    driverKextPermissionError: () => {
      set(s => {
        if (s.sfmi.driverStatus.type === T.FS.DriverStatusType.Disabled) {
          s.sfmi.driverStatus.kextPermissionError = true
          s.sfmi.driverStatus.isEnabling = false
        }
      })
    },
    dynamic: {
      afterDriverDisable: undefined,
      afterDriverDisabling: undefined,
      afterDriverEnabled: undefined,
      afterKbfsDaemonRpcStatusChanged: undefined,
      finishedDownloadWithIntentMobile: undefined,
      finishedRegularDownloadMobile: undefined,
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
                ...(s.tlfs[visibility].get(elems[2] ?? '') || unknownTlf),
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
            ...(s.tlfs[visibility].get(elems[2] ?? '') || unknownTlf),
            isIgnored: true,
          })
        )
      })
      C.ignorePromise(f())
    },
    favoritesLoad: () => {
      const f = async () => {
        try {
          if (!C.useConfigState.getState().loggedIn) {
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
                  ? tlfToPreferredOrder(folder.name, C.useCurrentUserState.getState().username)
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
            counts.set(Tabs.fsTab, computeBadgeNumberForAll(get().tlfs))
            C.useNotifState.getState().dispatch.setBadgeCounts(counts)
          }
        } catch (e) {
          errorToActionOrThrow(e)
        }
        return
      }
      C.ignorePromise(f())
    },
    finishManualConflictResolution: localViewTlfPath => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSFinishResolvingConflictRpcPromise({
          path: pathToRPCPath(localViewTlfPath),
        })
        get().dispatch.favoritesLoad()
      }
      C.ignorePromise(f())
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
              path: pathToRPCPath(rootPath),
              refreshSubscription: false,
            })
          } else {
            await T.RPCGen.SimpleFSSimpleFSListRpcPromise({
              filter: T.RPCGen.ListFilter.filterSystemHidden,
              opID,
              path: pathToRPCPath(rootPath),
              refreshSubscription: false,
            })
          }

          await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID}, folderListWaitingKey)

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
          const rootPathItem = getPathItem(get().pathItems, rootPath)
          const rootFolder: T.FS.FolderPathItem = {
            ...(rootPathItem.type === T.FS.PathType.Folder
              ? rootPathItem
              : {...emptyFolder, name: T.FS.getPathName(rootPath)}),
            children: new Set(childMap.get(rootPath)),
            progress: T.FS.ProgressType.Loaded,
          }

          const pathItems = new Map<T.FS.Path, T.FS.PathItem>([
            ...(T.FS.getPathLevel(rootPath) > 2 ? [[rootPath, rootFolder] as const] : []),
            ...entries.map(direntToPathAndPathItem),
          ] as const)
          set(s => {
            pathItems.forEach((pathItemFromAction, path) => {
              const oldPathItem = getPathItem(s.pathItems, path)
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
              const parent = getPathItem(s.pathItems, edit.parentPath)
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
      C.ignorePromise(f())
    },
    getOnlineStatus: () => {
      const f = async () => {
        await checkIfWeReConnectedToMDServerUpToNTimes(2)
      }
      C.ignorePromise(f())
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
      get().dispatch.dynamic.afterKbfsDaemonRpcStatusChanged?.()
    },
    letResetUserBackIn: (id, username) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamReAddMemberAfterResetRpcPromise({id, username})
        } catch (error) {
          errorToActionOrThrow(error)
        }
      }
      C.ignorePromise(f())
    },
    loadAdditionalTlf: tlfPath => {
      const f = async () => {
        if (T.FS.getPathLevel(tlfPath) !== 3) {
          logger.warn('loadAdditionalTlf called on non-TLF path')
          return
        }
        try {
          const {folder, isFavorite, isIgnored, isNew} = await T.RPCGen.SimpleFSSimpleFSGetFolderRpcPromise({
            path: pathToRPCPath(tlfPath).kbfs,
          })
          const tlfType = rpcFolderTypeToTlfType(folder.folderType)
          const tlfName =
            tlfType === T.FS.TlfType.Private || tlfType === T.FS.TlfType.Public
              ? tlfToPreferredOrder(folder.name, C.useCurrentUserState.getState().username)
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
            C.useRouterState.getState().dispatch.navigateUp()
            C.useRouterState.getState().dispatch.navigateAppend({
              props: {source: 'newFolder', usernames},
              selected: 'contactRestricted',
            })
          }
          errorToActionOrThrow(error, tlfPath)
        }
      }
      C.ignorePromise(f())
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
      C.ignorePromise(f())
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
      C.ignorePromise(f())
    },
    loadFileContext: path => {
      const f = async () => {
        try {
          const res = await T.RPCGen.SimpleFSSimpleFSGetGUIFileContextRpcPromise({
            path: pathToRPCPath(path).kbfs,
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
      C.ignorePromise(f())
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
      C.ignorePromise(f())
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
      C.ignorePromise(f())
    },
    loadPathMetadata: path => {
      const f = async () => {
        try {
          const dirent = await T.RPCGen.SimpleFSSimpleFSStatRpcPromise(
            {
              path: pathToRPCPath(path),
              refreshSubscription: false,
            },
            statWaitingKey
          )

          const pathItem = makeEntry(dirent)
          set(s => {
            const oldPathItem = getPathItem(s.pathItems, path)
            s.pathItems.set(path, T.castDraft(updatePathItem(oldPathItem, pathItem)))
            s.softErrors.pathErrors.delete(path)
            s.softErrors.tlfErrors.delete(path)
          })
        } catch (err) {
          errorToActionOrThrow(err, path)
          return
        }
      }
      C.ignorePromise(f())
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
      C.ignorePromise(f())
    },
    loadTlfSyncConfig: tlfPath => {
      const f = async () => {
        const parsedPath = parsePath(tlfPath)
        if (parsedPath.kind !== T.FS.PathKind.GroupTlf && parsedPath.kind !== T.FS.PathKind.TeamTlf) {
          return
        }
        try {
          const result = await T.RPCGen.SimpleFSSimpleFSFolderSyncConfigAndStatusRpcPromise({
            path: pathToRPCPath(tlfPath),
          })
          const syncConfig = getSyncConfigFromRPC(parsedPath.tlfName, parsedPath.tlfType, result.config)
          const tlfName = parsedPath.tlfName
          const tlfType = parsedPath.tlfType

          set(s => {
            const oldTlfList = s.tlfs[tlfType]
            const oldTlfFromFavorites = oldTlfList.get(tlfName) || unknownTlf
            if (oldTlfFromFavorites !== unknownTlf) {
              s.tlfs[tlfType] = T.castDraft(
                new Map([...oldTlfList, [tlfName, {...oldTlfFromFavorites, syncConfig}]])
              )
              return
            }

            const tlfPath = T.FS.pathConcat(T.FS.pathConcat(defaultPath, tlfType), tlfName)
            const oldTlfFromAdditional = s.tlfs.additionalTlfs.get(tlfPath) || unknownTlf
            if (oldTlfFromAdditional !== unknownTlf) {
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
      C.ignorePromise(f())
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
      C.ignorePromise(f())
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
                  dest: pathToRPCPath(
                    T.FS.pathConcat(
                      destinationParentPath,
                      T.FS.getPathName(zState.destinationPicker.source.path)
                    )
                  ),
                  opID: makeUUID(),
                  overwriteExistingFiles: false,
                  src: pathToRPCPath(zState.destinationPicker.source.path),
                },
              ]
            : zState.destinationPicker.source.source
                .map(item => ({originalPath: item.originalPath ?? '', scaledPath: item.scaledPath}))
                .filter(({originalPath}) => !!originalPath)
                .map(({originalPath, scaledPath}) => ({
                  dest: pathToRPCPath(
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
                      C.useConfigState.getState().incomingShareUseOriginal
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
      C.ignorePromise(f())
    },
    newFolderRow: parentPath => {
      const parentPathItem = getPathItem(get().pathItems, parentPath)
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
          ...emptyNewFolder,
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
    onEngineIncoming: action => {
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

      const {folderListLoad} = _useState.getState().dispatch
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
      C.ignorePromise(f())
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
            C.useNotifState.getState().dispatch.badgeApp('kbfsUploading', true)
            await C.timeoutPromise(getWaitDuration(endEstimate || undefined, 100, 4000)) // 0.1s to 4s
          }
        } finally {
          pollJournalStatusPolling = false
          C.useNotifState.getState().dispatch.badgeApp('kbfsUploading', false)
          get().dispatch.checkKbfsDaemonRpcStatus()
        }
      }
      C.ignorePromise(f())
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
      C.ignorePromise(f())
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
      get().dispatch.dynamic.refreshMountDirsDesktop?.()
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
          s.pathUserSettings.set(path, {...defaultPathUserSetting, sort: sortSetting})
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
      C.ignorePromise(f())
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
            path: pathToRPCPath(tlfPath),
          },
          syncToggleWaitingKey
        )
        get().dispatch.loadTlfSyncConfig(tlfPath)
      }
      C.ignorePromise(f())
    },
    setTlfsAsUnloaded: () => {
      set(s => {
        s.tlfs.loaded = false
      })
    },
    setupSubscriptions: () => {
      const f = async () => {
        const initPlatformSpecific = await import('./fs/platform-specific')
        initPlatformSpecific.default()
      }
      C.ignorePromise(f())
    },
    showIncomingShare: initialDestinationParentPath => {
      set(s => {
        if (s.destinationPicker.source.type !== T.FS.DestinationPickerSource.IncomingShare) {
          s.destinationPicker.source = {source: [], type: T.FS.DestinationPickerSource.IncomingShare}
        }
        s.destinationPicker.destinationParentPath = [initialDestinationParentPath]
      })
      C.useRouterState.getState().dispatch.navigateAppend({props: {index: 0}, selected: 'destinationPicker'})
    },
    showMoveOrCopy: initialDestinationParentPath => {
      set(s => {
        s.destinationPicker.source =
          s.destinationPicker.source.type === T.FS.DestinationPickerSource.MoveOrCopy
            ? s.destinationPicker.source
            : {
                path: defaultPath,
                type: T.FS.DestinationPickerSource.MoveOrCopy,
              }

        s.destinationPicker.destinationParentPath = [initialDestinationParentPath]
      })

      C.useRouterState.getState().dispatch.navigateAppend({props: {index: 0}, selected: 'destinationPicker'})
    },
    startManualConflictResolution: tlfPath => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSClearConflictStateRpcPromise({
          path: pathToRPCPath(tlfPath),
        })
        get().dispatch.favoritesLoad()
      }
      C.ignorePromise(f())
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
      C.ignorePromise(f())
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
      C.ignorePromise(f())
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
            C.useNotifState.getState().dispatch.badgeApp('outOfSpace', status.outOfSyncSpace)
            break
          }
          case T.FS.DiskSpaceStatus.Warning:
            {
              const threshold = humanizeBytes(get().settings.spaceAvailableNotificationThreshold, 0)
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
      C.ignorePromise(f())
    },
    upload: (parentPath, localPath) => {
      const f = async () => {
        try {
          await T.RPCGen.SimpleFSSimpleFSStartUploadRpcPromise({
            sourceLocalPath: T.FS.getNormalizedLocalPath(localPath),
            targetParentPath: pathToRPCPath(parentPath).kbfs,
          })
        } catch (err) {
          errorToActionOrThrow(err)
        }
      }
      C.ignorePromise(f())
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
      C.ignorePromise(f())
    },
    userIn: () => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSUserInRpcPromise({clientID})
      }
      C.ignorePromise(f())
      get().dispatch.checkKbfsDaemonRpcStatus()
    },
    userOut: () => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSUserOutRpcPromise({clientID})
      }
      C.ignorePromise(f())
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
      C.ignorePromise(f())
    },
  }

  return {
    ...initialStore,
    dispatch,
    getUploadIconForFilesTab,
  }
})
