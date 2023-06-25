import * as ConfigConstants from './config'
import * as NotificationsGen from '../actions/notifications-gen'
import * as FsGen from '../actions/fs-gen'
import * as RPCTypes from './types/rpc-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import * as Types from './types/fs'
import * as Z from '../util/zustand'
import NotifyPopup from '../util/notify-popup'
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../util/container'
import {RPCError} from '../util/errors'
import {isLinux, isMobile} from './platform'

export const syncToggleWaitingKey = 'fs:syncToggle'
export const folderListWaitingKey = 'fs:folderList'
export const statWaitingKey = 'fs:stat'
export const acceptMacOSFuseExtClosedSourceWaitingKey = 'fs:acceptMacOSFuseExtClosedSourceWaitingKey'
export const commitEditWaitingKey = 'fs:commitEditWaitingKey'
export const setSyncOnCellularWaitingKey = 'fs:setSyncOnCellular'

export const defaultPath = Types.stringToPath('/keybase')

// See Installer.m: KBExitFuseKextError
export const ExitCodeFuseKextError = 4
// See Installer.m: KBExitFuseKextPermissionError
export const ExitCodeFuseKextPermissionError = 5
// See Installer.m: KBExitAuthCanceledError
export const ExitCodeAuthCanceledError = 6

export const emptyNewFolder: Types.Edit = {
  error: undefined,
  name: 'New Folder',
  originalName: 'New Folder',
  parentPath: Types.stringToPath('/keybase'),
  type: Types.EditType.NewFolder,
}

export const prefetchNotStarted: Types.PrefetchNotStarted = {
  state: Types.PrefetchState.NotStarted,
}

export const prefetchComplete: Types.PrefetchComplete = {
  state: Types.PrefetchState.Complete,
}

export const emptyPrefetchInProgress: Types.PrefetchInProgress = {
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  startTime: 0,
  state: Types.PrefetchState.InProgress,
}

const pathItemMetadataDefault = {
  lastModifiedTimestamp: 0,
  lastWriter: '',
  name: 'unknown',
  prefetchStatus: prefetchNotStarted,
  size: 0,
  writable: false,
}

export const emptyFolder: Types.FolderPathItem = {
  ...pathItemMetadataDefault,
  children: new Set(),
  progress: Types.ProgressType.Pending,
  type: Types.PathType.Folder,
}

export const emptyFile: Types.FilePathItem = {
  ...pathItemMetadataDefault,
  type: Types.PathType.File,
}

export const emptySymlink: Types.SymlinkPathItem = {
  ...pathItemMetadataDefault,
  linkTarget: '',
  type: Types.PathType.Symlink,
}

export const unknownPathItem: Types.UnknownPathItem = {
  ...pathItemMetadataDefault,
  type: Types.PathType.Unknown,
}

export const tlfSyncEnabled: Types.TlfSyncEnabled = {
  mode: Types.TlfSyncMode.Enabled,
}

export const tlfSyncDisabled: Types.TlfSyncDisabled = {
  mode: Types.TlfSyncMode.Disabled,
}

export const makeTlfSyncPartial = ({
  enabledPaths,
}: {
  enabledPaths?: Types.TlfSyncPartial['enabledPaths']
}): Types.TlfSyncPartial => ({
  enabledPaths: [...(enabledPaths || [])],
  mode: Types.TlfSyncMode.Partial,
})

export const makeConflictStateNormalView = ({
  localViewTlfPaths,
  resolvingConflict,
  stuckInConflict,
}: Partial<Types.ConflictStateNormalView>): Types.ConflictStateNormalView => ({
  localViewTlfPaths: [...(localViewTlfPaths || [])],
  resolvingConflict: resolvingConflict || false,
  stuckInConflict: stuckInConflict || false,
  type: Types.ConflictStateType.NormalView,
})

export const tlfNormalViewWithNoConflict = makeConflictStateNormalView({})

export const makeConflictStateManualResolvingLocalView = ({
  normalViewTlfPath,
}: Partial<Types.ConflictStateManualResolvingLocalView>): Types.ConflictStateManualResolvingLocalView => ({
  normalViewTlfPath: normalViewTlfPath || defaultPath,
  type: Types.ConflictStateType.ManualResolvingLocalView,
})

export const makeTlf = (p: Partial<Types.Tlf>): Types.Tlf => {
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

export const emptySyncingFoldersProgress: Types.SyncingFoldersProgress = {
  bytesFetched: 0,
  bytesTotal: 0,
  endEstimate: 0,
  start: 0,
}

export const emptyOverallSyncStatus: Types.OverallSyncStatus = {
  diskSpaceStatus: Types.DiskSpaceStatus.Ok,
  showingBanner: false,
  syncingFoldersProgress: emptySyncingFoldersProgress,
}

export const defaultPathUserSetting: Types.PathUserSetting = {
  sort: Types.SortSetting.NameAsc,
}

export const defaultTlfListPathUserSetting: Types.PathUserSetting = {
  sort: Types.SortSetting.TimeAsc,
}

export const emptyDownloadState: Types.DownloadState = {
  canceled: false,
  done: false,
  endEstimate: 0,
  error: '',
  localPath: '',
  progress: 0,
}

export const emptyDownloadInfo: Types.DownloadInfo = {
  filename: '',
  isRegularDownload: false,
  path: defaultPath,
  startTime: 0,
}

export const emptyPathItemActionMenu: Types.PathItemActionMenu = {
  downloadID: undefined,
  downloadIntent: undefined,
  previousView: Types.PathItemActionMenuView.Root,
  view: Types.PathItemActionMenuView.Root,
}

export const driverStatusUnknown: Types.DriverStatusUnknown = {
  type: Types.DriverStatusType.Unknown,
} as const

export const emptyDriverStatusEnabled: Types.DriverStatusEnabled = {
  dokanOutdated: false,
  dokanUninstallExecPath: undefined,
  isDisabling: false,
  type: Types.DriverStatusType.Enabled,
} as const

export const emptyDriverStatusDisabled: Types.DriverStatusDisabled = {
  isEnabling: false,
  kextPermissionError: false,
  type: Types.DriverStatusType.Disabled,
} as const

export const defaultDriverStatus: Types.DriverStatus = isLinux
  ? emptyDriverStatusEnabled
  : driverStatusUnknown

export const unknownKbfsDaemonStatus: Types.KbfsDaemonStatus = {
  onlineStatus: Types.KbfsDaemonOnlineStatus.Unknown,
  rpcStatus: Types.KbfsDaemonRpcStatus.Waiting,
}

export const emptySettings: Types.Settings = {
  isLoading: false,
  loaded: false,
  sfmiBannerDismissed: false,
  spaceAvailableNotificationThreshold: 0,
  syncOnCellular: false,
}

export const emptyPathInfo: Types.PathInfo = {
  deeplinkPath: '',
  platformAfterMountPath: '',
}

export const emptyFileContext: Types.FileContext = {
  contentType: '',
  url: '',
  viewType: RPCTypes.GUIViewType.default,
}

export const getPathItem = (pathItems: Map<Types.Path, Types.PathItem>, path: Types.Path): Types.PathItem =>
  pathItems.get(path) || (unknownPathItem as Types.PathItem)

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

export const pathToRPCPath = (
  path: Types.Path
): {PathType: RPCTypes.PathType.kbfs; kbfs: RPCTypes.KBFSPath} => ({
  PathType: RPCTypes.PathType.kbfs,
  kbfs: {
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
    path: Types.pathToString(path).substring('/keybase'.length) || '/',
  },
})

export const rpcPathToPath = (rpcPath: RPCTypes.KBFSPath) => Types.pathConcat(defaultPath, rpcPath.path)

export const pathTypeToTextType = (type: Types.PathType) =>
  type === Types.PathType.Folder ? 'BodySemibold' : 'Body'

export const splitTlfIntoUsernames = (tlf: string): Array<string> =>
  tlf.split(' ')[0].replace(/#/g, ',').split(',')

export const getUsernamesFromPath = (path: Types.Path): Array<string> => {
  const elems = Types.getPathElements(path)
  return elems.length < 3 ? [] : splitTlfIntoUsernames(elems[2])
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

export const downloadIsOngoing = (dlState: Types.DownloadState) =>
  dlState !== emptyDownloadState && !dlState.error && !dlState.done && !dlState.canceled

export const getDownloadIntentFromAction = (
  action: FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload
): Types.DownloadIntent =>
  action.type === FsGen.download
    ? Types.DownloadIntent.None
    : action.type === FsGen.shareNative
    ? Types.DownloadIntent.Share
    : Types.DownloadIntent.CameraRoll

export const getDownloadIntent = (
  path: Types.Path,
  downloads: Types.Downloads,
  pathItemActionMenu: Types.PathItemActionMenu
): Types.DownloadIntent | undefined => {
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
  return Types.DownloadIntent.None
}

export const emptyTlfUpdate: Types.TlfUpdate = {
  history: [],
  path: Types.stringToPath(''),
  serverTime: 0,
  writer: '',
}

export const emptyTlfEdit: Types.TlfEdit = {
  editType: Types.FileEditType.Unknown,
  filename: '',
  serverTime: 0,
}

const fsNotificationTypeToEditType = (fsNotificationType: number): Types.FileEditType => {
  switch (fsNotificationType) {
    case RPCTypes.FSNotificationType.fileCreated:
      return Types.FileEditType.Created
    case RPCTypes.FSNotificationType.fileModified:
      return Types.FileEditType.Modified
    case RPCTypes.FSNotificationType.fileDeleted:
      return Types.FileEditType.Deleted
    case RPCTypes.FSNotificationType.fileRenamed:
      return Types.FileEditType.Renamed
    default:
      return Types.FileEditType.Unknown
  }
}

export const userTlfHistoryRPCToState = (
  history: Array<RPCTypes.FSFolderEditHistory>
): Types.UserTlfUpdates => {
  let updates: Array<Types.TlfUpdate> = []
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

export const canSaveMedia = (pathItem: Types.PathItem, fileContext: Types.FileContext): boolean => {
  if (pathItem.type !== Types.PathType.File || fileContext === emptyFileContext) {
    return false
  }
  return (
    fileContext.viewType === RPCTypes.GUIViewType.image || fileContext.viewType === RPCTypes.GUIViewType.video
  )
}

export const folderRPCFromPath = (path: Types.Path): RPCTypes.FolderHandle | undefined => {
  const pathElems = Types.getPathElements(path)
  if (pathElems.length === 0) return undefined

  const visibility = Types.getVisibilityFromElems(pathElems)
  if (visibility === undefined) return undefined

  const name = Types.getPathNameFromElems(pathElems)
  if (name === '') return undefined

  return {
    created: false,
    folderType: Types.getRPCFolderTypeFromVisibility(visibility),
    name,
  }
}

export const pathFromFolderRPC = (folder: RPCTypes.Folder): Types.Path => {
  const visibility = Types.getVisibilityFromRPCFolderType(folder.folderType)
  if (!visibility) return Types.stringToPath('')
  return Types.stringToPath(`/keybase/${visibility}/${folder.name}`)
}

export const showIgnoreFolder = (path: Types.Path, username?: string): boolean => {
  const elems = Types.getPathElements(path)
  if (elems.length !== 3) {
    return false
  }
  return ['public', 'private'].includes(elems[1]) && elems[2] !== username
}

export const syntheticEventToTargetRect = (evt?: React.SyntheticEvent): ClientRect | undefined =>
  isMobile ? undefined : evt ? (evt.target as HTMLElement).getBoundingClientRect() : undefined

export const invalidTokenError = new Error('invalid token')
export const notFoundError = new Error('not found')

export const makeEditID = (): Types.EditID => Types.stringToEditID(makeUUID())

export const getTlfListFromType = (tlfs: Types.Tlfs, tlfType: Types.TlfType): Types.TlfList => {
  switch (tlfType) {
    case Types.TlfType.Private:
      return tlfs.private
    case Types.TlfType.Public:
      return tlfs.public
    case Types.TlfType.Team:
      return tlfs.team
    default:
      return new Map()
  }
}

export const computeBadgeNumberForTlfList = (tlfList: Types.TlfList): number =>
  [...tlfList.values()].reduce((accumulator, tlf) => (tlfIsBadged(tlf) ? accumulator + 1 : accumulator), 0)

export const computeBadgeNumberForAll = (tlfs: Types.Tlfs): number =>
  [Types.TlfType.Private, Types.TlfType.Public, Types.TlfType.Team]
    .map(tlfType => computeBadgeNumberForTlfList(getTlfListFromType(tlfs, tlfType)))
    .reduce((sum, count) => sum + count, 0)

export const getTlfPath = (path: Types.Path): Types.Path => {
  const elems = Types.getPathElements(path)
  return elems.length > 2 ? Types.pathConcat(Types.pathConcat(defaultPath, elems[1]), elems[2]) : undefined
}

export const getTlfListAndTypeFromPath = (
  tlfs: Types.Tlfs,
  path: Types.Path
): {
  tlfList: Types.TlfList
  tlfType: Types.TlfType
} => {
  const visibility = Types.getPathVisibility(path)
  switch (visibility) {
    case Types.TlfType.Private:
    case Types.TlfType.Public:
    case Types.TlfType.Team: {
      const tlfType: Types.TlfType = visibility
      return {tlfList: getTlfListFromType(tlfs, tlfType), tlfType}
    }
    default:
      return {tlfList: new Map(), tlfType: Types.TlfType.Private}
  }
}

export const unknownTlf = makeTlf({})
export const getTlfFromPathInFavoritesOnly = (tlfs: Types.Tlfs, path: Types.Path): Types.Tlf => {
  const elems = Types.getPathElements(path)
  if (elems.length < 3) {
    return unknownTlf
  }
  const {tlfList} = getTlfListAndTypeFromPath(tlfs, path)
  return tlfList.get(elems[2]) || unknownTlf
}

export const getTlfFromPath = (tlfs: Types.Tlfs, path: Types.Path): Types.Tlf => {
  const fromFavorites = getTlfFromPathInFavoritesOnly(tlfs, path)
  return fromFavorites !== unknownTlf
    ? fromFavorites
    : tlfs.additionalTlfs.get(getTlfPath(path)) || unknownTlf
}

export const getTlfFromTlfs = (tlfs: Types.Tlfs, tlfType: Types.TlfType, name: string): Types.Tlf => {
  switch (tlfType) {
    case Types.TlfType.Private:
      return tlfs.private.get(name) || unknownTlf
    case Types.TlfType.Public:
      return tlfs.public.get(name) || unknownTlf
    case Types.TlfType.Team:
      return tlfs.team.get(name) || unknownTlf
    default:
      return unknownTlf
  }
}

export const tlfTypeAndNameToPath = (tlfType: Types.TlfType, name: string): Types.Path =>
  Types.stringToPath(`/keybase/${tlfType}/${name}`)

export const resetBannerType = (state: TypedState, path: Types.Path): Types.ResetBannerType => {
  const resetParticipants = getTlfFromPath(state.fs.tlfs, path).resetParticipants
  if (resetParticipants.length === 0) {
    return Types.ResetBannerNoOthersType.None
  }

  const you = ConfigConstants.useCurrentUserState.getState().username
  if (resetParticipants.findIndex(username => username === you) >= 0) {
    return Types.ResetBannerNoOthersType.Self
  }
  return resetParticipants.length
}

export const getUploadedPath = (parentPath: Types.Path, localPath: string) =>
  Types.pathConcat(parentPath, Types.getLocalPathName(localPath))

export const usernameInPath = (username: string, path: Types.Path) => {
  const elems = Types.getPathElements(path)
  return elems.length >= 3 && elems[2].split(',').includes(username)
}

export const getUsernamesFromTlfName = (tlfName: string): Array<string> => {
  const split = splitTlfIntoReadersAndWriters(tlfName)
  return split.writers.concat(split.readers || [])
}

export const isOfflineUnsynced = (
  daemonStatus: Types.KbfsDaemonStatus,
  pathItem: Types.PathItem,
  path: Types.Path
) =>
  daemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline &&
  Types.getPathLevel(path) > 2 &&
  pathItem.prefetchStatus !== prefetchComplete

// To make sure we have consistent badging, all badging related stuff should go
// through this function. That is:
// * When calculating number of TLFs being badged, a TLF should be counted if
//   and only if this function returns true.
// * When an individual TLF is shown (e.g. as a row), it should be badged if
//   and only if this funciton returns true.
//
// If we add more badges, this function should be updated.
export const tlfIsBadged = (tlf: Types.Tlf) => !tlf.isIgnored && tlf.isNew

export const pathsInSameTlf = (a: Types.Path, b: Types.Path): boolean => {
  const elemsA = Types.getPathElements(a)
  const elemsB = Types.getPathElements(b)
  return elemsA.length >= 3 && elemsB.length >= 3 && elemsA[1] === elemsB[1] && elemsA[2] === elemsB[2]
}

const slashKeybaseSlashLength = '/keybase/'.length
// TODO: move this to Go
export const escapePath = (path: Types.Path): string =>
  'keybase://' +
  encodeURIComponent(Types.pathToString(path).slice(slashKeybaseSlashLength)).replace(
    // We need to do this because otherwise encodeURIComponent would encode
    // "/"s.
    /%2F/g,
    '/'
  )

export const parsedPathRoot: Types.ParsedPathRoot = {kind: Types.PathKind.Root}

export const parsedPathPrivateList: Types.ParsedPathTlfList = {
  kind: Types.PathKind.TlfList,
  tlfType: Types.TlfType.Private,
}

export const parsedPathPublicList: Types.ParsedPathTlfList = {
  kind: Types.PathKind.TlfList,
  tlfType: Types.TlfType.Public,
}

export const parsedPathTeamList: Types.ParsedPathTlfList = {
  kind: Types.PathKind.TlfList,
  tlfType: Types.TlfType.Team,
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
    writers: w.split(',').filter(i => !!i),
  }
}

// returns parsedPathRoot if unknown
export const parsePath = (path: Types.Path): Types.ParsedPath => {
  const elems = Types.getPathElements(path)
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
            kind: Types.PathKind.GroupTlf,
            tlfName: elems[2],
            tlfType: Types.TlfType.Private,
            ...splitTlfIntoReadersAndWriters(elems[2]),
          }
        default:
          return {
            kind: Types.PathKind.InGroupTlf,
            rest: elems.slice(3),
            tlfName: elems[2],
            tlfType: Types.TlfType.Private,
            ...splitTlfIntoReadersAndWriters(elems[2]),
          }
      }
    case 'public':
      switch (elems.length) {
        case 2:
          return parsedPathPublicList
        case 3:
          return {
            kind: Types.PathKind.GroupTlf,
            tlfName: elems[2],
            tlfType: Types.TlfType.Public,
            ...splitTlfIntoReadersAndWriters(elems[2]),
          }
        default:
          return {
            kind: Types.PathKind.InGroupTlf,
            rest: elems.slice(3),
            tlfName: elems[2],
            tlfType: Types.TlfType.Public,
            ...splitTlfIntoReadersAndWriters(elems[2]),
          }
      }
    case 'team':
      switch (elems.length) {
        case 2:
          return parsedPathTeamList
        case 3:
          return {
            kind: Types.PathKind.TeamTlf,
            team: elems[2],
            tlfName: elems[2],
            tlfType: Types.TlfType.Team,
          }
        default:
          return {
            kind: Types.PathKind.InTeamTlf,
            rest: elems.slice(3),
            team: elems[2],
            tlfName: elems[2],
            tlfType: Types.TlfType.Team,
          }
      }
    default:
      return parsedPathRoot
  }
}

export const rebasePathToDifferentTlf = (path: Types.Path, newTlfPath: Types.Path) =>
  Types.pathConcat(newTlfPath, Types.getPathElements(path).slice(3).join('/'))

export const canChat = (path: Types.Path) => {
  const parsedPath = parsePath(path)
  switch (parsedPath.kind) {
    case Types.PathKind.Root:
    case Types.PathKind.TlfList:
      return false
    case Types.PathKind.GroupTlf:
    case Types.PathKind.TeamTlf:
      return true
    case Types.PathKind.InGroupTlf:
    case Types.PathKind.InTeamTlf:
      return true
    default:
      return false
  }
}

export const isTeamPath = (path: Types.Path): boolean => {
  const parsedPath = parsePath(path)
  return parsedPath.kind !== Types.PathKind.Root && parsedPath.tlfType === Types.TlfType.Team
}

export const getChatTarget = (path: Types.Path, me: string): string => {
  const parsedPath = parsePath(path)
  if (parsedPath.kind !== Types.PathKind.Root && parsedPath.tlfType === Types.TlfType.Team) {
    return 'team conversation'
  }
  if (parsedPath.kind === Types.PathKind.GroupTlf || parsedPath.kind === Types.PathKind.InGroupTlf) {
    if (parsedPath.writers.length === 1 && !parsedPath.readers && parsedPath.writers[0] === me) {
      return 'yourself'
    }
    if (parsedPath.writers.length + (parsedPath.readers ? parsedPath.readers.length : 0) === 2) {
      const notMe = parsedPath.writers.concat(parsedPath.readers || []).filter(u => u !== me)
      if (notMe.length === 1) {
        return notMe[0]
      }
    }
    return 'group conversation'
  }
  return 'conversation'
}

export const getSharePathArrayDescription = (paths: Array<Types.LocalPath | string>): string => {
  return !paths.length ? '' : paths.length === 1 ? Types.getPathName(paths[0]) : `${paths.length} items`
}

export const getDestinationPickerPathName = (picker: Types.DestinationPicker): string =>
  picker.source.type === Types.DestinationPickerSource.MoveOrCopy
    ? Types.getPathName(picker.source.path)
    : picker.source.type === Types.DestinationPickerSource.IncomingShare
    ? Array.isArray(picker.source.source)
      ? getSharePathArrayDescription(
          picker.source.source
            .map(({originalPath}) => (originalPath ? Types.getLocalPathName(originalPath) : ''))
            .filter(Boolean)
        )
      : picker.source.source
    : ''

const isPathEnabledForSync = (syncConfig: Types.TlfSyncConfig, path: Types.Path): boolean => {
  switch (syncConfig.mode) {
    case Types.TlfSyncMode.Disabled:
      return false
    case Types.TlfSyncMode.Enabled:
      return true
    case Types.TlfSyncMode.Partial:
      // TODO: when we enable partial sync lookup, remember to deal with
      // potential ".." traversal as well.
      return syncConfig.enabledPaths.includes(path)
    default:
      return false
  }
}

export const getUploadIconForTlfType = (
  kbfsDaemonStatus: Types.KbfsDaemonStatus,
  uploads: Types.Uploads,
  tlfList: Types.TlfList,
  tlfType: Types.TlfType
): Types.UploadIcon | undefined => {
  if (
    [...tlfList].some(
      ([_, tlf]) =>
        tlf.conflictState.type === Types.ConflictStateType.NormalView && tlf.conflictState.stuckInConflict
    )
  ) {
    return Types.UploadIcon.UploadingStuck
  }

  const prefix = Types.pathToString(Types.getTlfTypePathFromTlfType(tlfType))
  if (
    [...uploads.syncingPaths].some(p => Types.pathToString(p).startsWith(prefix)) ||
    [...uploads.writingToJournal.keys()].some(p => Types.pathToString(p).startsWith(prefix))
  ) {
    return kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline
      ? Types.UploadIcon.AwaitingToUpload
      : Types.UploadIcon.Uploading
  }

  return undefined
}

export const tlfIsStuckInConflict = (tlf: Types.Tlf) =>
  tlf.conflictState.type === Types.ConflictStateType.NormalView && tlf.conflictState.stuckInConflict

export const getPathStatusIconInMergeProps = (
  kbfsDaemonStatus: Types.KbfsDaemonStatus,
  tlf: Types.Tlf,
  pathItem: Types.PathItem,
  uploadingPaths: Set<Types.Path>,
  path: Types.Path
): Types.PathStatusIcon => {
  // There's no upload or sync for local conflict view.
  if (tlf.conflictState.type === Types.ConflictStateType.ManualResolvingLocalView) {
    return Types.LocalConflictStatus
  }

  // uploading state has higher priority
  if (uploadingPaths.has(path)) {
    return tlf.conflictState.type === Types.ConflictStateType.NormalView && tlf.conflictState.stuckInConflict
      ? Types.UploadIcon.UploadingStuck
      : kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline
      ? Types.UploadIcon.AwaitingToUpload
      : Types.UploadIcon.Uploading
  }
  if (!isPathEnabledForSync(tlf.syncConfig, path)) {
    return Types.NonUploadStaticSyncStatus.OnlineOnly
  }

  if (
    !tlf.syncConfig ||
    (pathItem === unknownPathItem && tlf.syncConfig.mode !== Types.TlfSyncMode.Disabled)
  ) {
    return Types.NonUploadStaticSyncStatus.Unknown
  }

  // TODO: what about 'sync-error'?

  // We don't have an upload state, and sync is enabled for this path.
  switch (pathItem.prefetchStatus.state) {
    case Types.PrefetchState.NotStarted:
      return Types.NonUploadStaticSyncStatus.AwaitingToSync
    case Types.PrefetchState.Complete:
      return Types.NonUploadStaticSyncStatus.Synced
    case Types.PrefetchState.InProgress: {
      if (kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline) {
        return Types.NonUploadStaticSyncStatus.AwaitingToSync
      }
      const inProgress: Types.PrefetchInProgress = pathItem.prefetchStatus
      if (inProgress.bytesTotal === 0) {
        return Types.NonUploadStaticSyncStatus.AwaitingToSync
      }
      return inProgress.bytesFetched / inProgress.bytesTotal
    }
    default:
      return Types.NonUploadStaticSyncStatus.Unknown
  }
}

type SafeNavigateAppendArg = {path: any; replace?: boolean}
export const makeActionsForDestinationPickerOpen = (
  index: number,
  path: Types.Path,
  navigateAppend: (a: SafeNavigateAppendArg) => TypedActions,
  headerRightButton?: React.ReactNode
): ReadonlyArray<TypedActions> => {
  useState.getState().dispatch.setDestinationPickerParentPath(index, path)
  return [
    navigateAppend({
      path: [{props: {headerRightButton, index}, selected: 'destinationPicker'}],
    }),
  ] as const
}

export const fsRootRouteForNav1 = isMobile ? [Tabs.settingsTab, SettingsConstants.fsTab] : [Tabs.fsTab]

export const makeActionForOpenPathInFilesTab = (
  // TODO: remove the second arg when we are done with migrating to nav2
  path: Types.Path
): TypedActions => RouteTreeGen.createNavigateAppend({path: [{props: {path}, selected: 'fsRoot'}]})

export const putActionIfOnPathForNav1 = (action: TypedActions) => action

export const getMainBannerType = (
  kbfsDaemonStatus: Types.KbfsDaemonStatus,
  overallSyncStatus: Types.OverallSyncStatus
): Types.MainBannerType => {
  if (kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline) {
    return Types.MainBannerType.Offline
  } else if (kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Trying) {
    return Types.MainBannerType.TryingToConnect
  } else if (overallSyncStatus.diskSpaceStatus === 'error') {
    return Types.MainBannerType.OutOfSpace
  } else {
    return Types.MainBannerType.None
  }
}

export const isFolder = (path: Types.Path, pathItem: Types.PathItem) =>
  Types.getPathLevel(path) <= 3 || pathItem.type === Types.PathType.Folder

export const isInTlf = (path: Types.Path) => Types.getPathLevel(path) > 2

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

export const hasPublicTag = (path: Types.Path): boolean => {
  const publicPrefix = '/keybase/public/'
  // The slash after public in `publicPrefix` prevents /keybase/public from counting.
  return Types.pathToString(path).startsWith(publicPrefix)
}

export const getPathUserSetting = (
  pathUserSettings: Map<Types.Path, Types.PathUserSetting>,
  path: Types.Path
): Types.PathUserSetting =>
  pathUserSettings.get(path) ||
  (Types.getPathLevel(path) < 3 ? defaultTlfListPathUserSetting : defaultPathUserSetting)

export const showSortSetting = (
  path: Types.Path,
  pathItem: Types.PathItem,
  kbfsDaemonStatus: Types.KbfsDaemonStatus
) =>
  !isMobile &&
  path !== defaultPath &&
  (Types.getPathLevel(path) === 2 || (pathItem.type === Types.PathType.Folder && !!pathItem.children.size)) &&
  !isOfflineUnsynced(kbfsDaemonStatus, pathItem, path)

export const getSoftError = (softErrors: Types.SoftErrors, path: Types.Path): Types.SoftError | undefined => {
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

export const hasSpecialFileElement = (path: Types.Path): boolean =>
  Types.getPathElements(path).some(elem => elem.startsWith('.kbfs'))

export const sfmiInfoLoaded = (settings: Types.Settings, driverStatus: Types.DriverStatus): boolean =>
  settings.loaded && driverStatus !== driverStatusUnknown

// This isn't perfect since it doesn't cover the case of multi-writer public
// TLFs or where a team TLF is readonly to the user. But to do that we'd need
// some new caching in KBFS to plumb it into the Tlfs structure without
// awful overhead.
export const hideOrDisableInDestinationPicker = (
  tlfType: Types.TlfType,
  name: string,
  username: string,
  destinationPickerIndex?: number
) => typeof destinationPickerIndex === 'number' && tlfType === Types.TlfType.Public && name !== username

const noAccessErrorCodes = [
  RPCTypes.StatusCode.scsimplefsnoaccess,
  RPCTypes.StatusCode.scteamnotfound,
  RPCTypes.StatusCode.scteamreaderror,
]

export const errorToActionOrThrow = (error: any, path?: Types.Path) => {
  if (error?.code === RPCTypes.StatusCode.sckbfsclienttimeout) {
    useState.getState().dispatch.checkKbfsDaemonRpcStatus()
    return
  }
  if (error?.code === RPCTypes.StatusCode.scidentifiesfailed) {
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
  if (path && error?.code === RPCTypes.StatusCode.scsimplefsnotexist) {
    useState.getState().dispatch.setPathSoftError(path, Types.SoftError.Nonexistent)
    return
  }
  if (path && noAccessErrorCodes.includes(error?.code)) {
    const tlfPath = getTlfPath(path)
    if (tlfPath) {
      useState.getState().dispatch.setTlfSoftError(tlfPath, Types.SoftError.NoAccess)
      return
    }
  }
  if (error?.code === RPCTypes.StatusCode.scdeleted) {
    // The user is deleted. Let user know and move on.
    useState.getState().dispatch.redbar('A user in this shared folder has deleted their account.')
    return
  }
  throw error
}

type State = {
  badge: RPCTypes.FilesTabBadge
  criticalUpdate: boolean
  destinationPicker: Types.DestinationPicker
  downloads: Types.Downloads
  edits: Types.Edits
  errors: Array<string>
  fileContext: Map<Types.Path, Types.FileContext>
  folderViewFilter: string | undefined // on mobile, '' is expanded empty, undefined is unexpanded
  kbfsDaemonStatus: Types.KbfsDaemonStatus
  lastPublicBannerClosedTlf: string
  overallSyncStatus: Types.OverallSyncStatus
  pathItemActionMenu: Types.PathItemActionMenu
  pathItems: Types.PathItems
  pathInfos: Map<Types.Path, Types.PathInfo>
  pathUserSettings: Map<Types.Path, Types.PathUserSetting>
  settings: Types.Settings
  sfmi: Types.SystemFileManagerIntegration
  softErrors: Types.SoftErrors
  tlfUpdates: Types.UserTlfUpdates
}
const initialState: State = {
  badge: RPCTypes.FilesTabBadge.none,
  criticalUpdate: false,
  destinationPicker: {
    destinationParentPath: [],
    source: {
      type: Types.DestinationPickerSource.None,
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
}

type ZState = State & {
  dispatch: {
    checkKbfsDaemonRpcStatus: () => void
    commitEdit: (editID: Types.EditID) => void
    discardEdit: (editID: Types.EditID) => void
    dismissRedbar: (index: number) => void
    driverDisabling: () => void
    driverEnable: (isRetry?: boolean) => void
    driverKextPermissionError: () => void
    editError: (editID: Types.EditID, error: string) => void
    editSuccess: (editID: Types.EditID) => void
    folderListLoad: (path: Types.Path, recursive: boolean) => void
    kbfsDaemonOnlineStatusChanged: (onlineStatus: RPCTypes.KbfsOnlineStatus) => void
    kbfsDaemonRpcStatusChanged: (rpcStatus: Types.KbfsDaemonRpcStatus) => void
    loadFileContext: (path: Types.Path) => void
    loadPathMetadata: (path: Types.Path) => void
    loadSettings: () => void
    loadedDownloadInfo: (downloadID: string, info: Types.DownloadInfo) => void
    loadedDownloadStatus: (regularDownloads: Array<string>, state: Map<string, Types.DownloadState>) => void
    loadedPathInfo: (path: Types.Path, info: Types.PathInfo) => void
    newFolderRow: (parentPath: Types.Path) => void
    onChangedFocus: (appFocused: boolean) => void
    redbar: (error: string) => void
    reset: () => void
    setBadge: (b: RPCTypes.FilesTabBadge) => void
    setCriticalUpdate: (u: boolean) => void
    setDestinationPickerParentPath: (index: number, path: Types.Path) => void
    setDirectMountDir: (directMountDir: string) => void
    setDriverStatus: (driverStatus: Types.DriverStatus) => void
    setEditName: (editID: Types.EditID, name: string) => void
    setFolderViewFilter: (filter?: string) => void
    setIncomingShareSource: (source: Array<RPCTypes.IncomingShareItem>) => void
    setLastPublicBannerClosedTlf: (tlf: string) => void
    setMoveOrCopySource: (path: Types.Path) => void
    setPathItemActionMenuDownload: (downloadID?: string, intent?: Types.DownloadIntent) => void
    setPathItemActionMenuView: (view: Types.PathItemActionMenuView) => void
    setPreferredMountDirs: (preferredMountDirs: Array<string>) => void
    setPathSoftError: (path: Types.Path, softError?: Types.SoftError) => void
    setTlfSoftError: (path: Types.Path, softError?: Types.SoftError) => void
    setSorting: (path: Types.Path, sortSetting: Types.SortSetting) => void
    showIncomingShare: (initialDestinationParentPath: Types.Path) => void
    showMoveOrCopy: (initialDestinationParentPath: Types.Path) => void
    startRename: (path: Types.Path) => void
    syncStatusChanged: (status: RPCTypes.FolderSyncStatus) => void
    userFileEditsLoad: () => void
    waitForKbfsDaemon: () => void
  }
  getUploadIconForFilesTab: () => Types.UploadIcon | undefined
}

const getPrefetchStatusFromRPC = (
  prefetchStatus: RPCTypes.PrefetchStatus,
  prefetchProgress: RPCTypes.PrefetchProgress
) => {
  switch (prefetchStatus) {
    case RPCTypes.PrefetchStatus.notStarted:
      return prefetchNotStarted
    case RPCTypes.PrefetchStatus.inProgress:
      return {
        ...emptyPrefetchInProgress,
        bytesFetched: prefetchProgress.bytesFetched,
        bytesTotal: prefetchProgress.bytesTotal,
        endEstimate: prefetchProgress.endEstimate,
        startTime: prefetchProgress.start,
      }
    case RPCTypes.PrefetchStatus.complete:
      return prefetchComplete
    default:
      return prefetchNotStarted
  }
}

const direntToMetadata = (d: RPCTypes.Dirent) => ({
  lastModifiedTimestamp: d.time,
  lastWriter: d.lastWriterUnverified.username,
  name: d.name.split('/').pop(),
  prefetchStatus: getPrefetchStatusFromRPC(d.prefetchStatus, d.prefetchProgress),
  size: d.size,
  writable: d.writable,
})

const makeEntry = (d: RPCTypes.Dirent, children?: Set<string>): Types.PathItem => {
  switch (d.direntType) {
    case RPCTypes.DirentType.dir:
      return {
        ...emptyFolder,
        ...direntToMetadata(d),
        children: new Set(children || []),
        progress: children ? Types.ProgressType.Loaded : Types.ProgressType.Pending,
      } as Types.PathItem
    case RPCTypes.DirentType.sym:
      return {
        ...emptySymlink,
        ...direntToMetadata(d),
        // TODO: plumb link target
      } as Types.PathItem
    case RPCTypes.DirentType.file:
    case RPCTypes.DirentType.exec:
      return {
        ...emptyFile,
        ...direntToMetadata(d),
      } as Types.PathItem
  }
}

const updatePathItem = (
  oldPathItem: Types.PathItem,
  newPathItemFromAction: Types.PathItem
): Types.PathItem => {
  if (
    oldPathItem.type === Types.PathType.Folder &&
    newPathItemFromAction.type === Types.PathType.Folder &&
    oldPathItem.progress === Types.ProgressType.Loaded &&
    newPathItemFromAction.progress === Types.ProgressType.Pending
  ) {
    // The new one doesn't have children, but the old one has. We don't
    // want to override a loaded folder into pending. So first set the children
    // in new one using what we already have, see if they are equal.
    const newPathItemNoOverridingChildrenAndProgress = {
      ...newPathItemFromAction,
      children: oldPathItem.children,
      progress: Types.ProgressType.Loaded,
    }
    return newPathItemNoOverridingChildrenAndProgress
  }
  return newPathItemFromAction
}

export const useState = Z.createZustand(
  Z.immerZustand<ZState>((set, get) => {
    const reduxDispatch = Z.getReduxDispatch()
    // const getReduxStore = Z.getReduxStore()

    // Can't rely on kbfsDaemonStatus.rpcStatus === 'waiting' as that's set by
    // reducer and happens before this.
    let waitForKbfsDaemonInProgress = false

    const getUploadIconForFilesTab = () => {
      switch (get().badge) {
        case RPCTypes.FilesTabBadge.awaitingUpload:
          return Types.UploadIcon.AwaitingToUpload
        case RPCTypes.FilesTabBadge.uploadingStuck:
          return Types.UploadIcon.UploadingStuck
        case RPCTypes.FilesTabBadge.uploading:
          return Types.UploadIcon.Uploading
        case RPCTypes.FilesTabBadge.none:
          return undefined
      }
    }
    const dispatch = {
      checkKbfsDaemonRpcStatus: () => {
        const f = async () => {
          const connected = await RPCTypes.configWaitForClientRpcPromise({
            clientType: RPCTypes.ClientType.kbfs,
            timeout: 0, // Don't wait; just check if it's there.
          })
          const newStatus = connected
            ? Types.KbfsDaemonRpcStatus.Connected
            : Types.KbfsDaemonRpcStatus.Waiting
          const kbfsDaemonStatus = get().kbfsDaemonStatus
          const {kbfsDaemonRpcStatusChanged, waitForKbfsDaemon} = get().dispatch

          if (kbfsDaemonStatus.rpcStatus !== newStatus) {
            kbfsDaemonRpcStatusChanged(newStatus)
          }
          if (newStatus === Types.KbfsDaemonRpcStatus.Waiting) {
            waitForKbfsDaemon()
          }
        }
        Z.ignorePromise(f())
      },
      commitEdit: (editID: Types.EditID) => {
        const edit = get().edits.get(editID)
        if (!edit) {
          return
        }
        const f = async () => {
          switch (edit.type) {
            case Types.EditType.NewFolder:
              try {
                await RPCTypes.SimpleFSSimpleFSOpenRpcPromise(
                  {
                    dest: pathToRPCPath(Types.pathConcat(edit.parentPath, edit.name)),
                    flags: RPCTypes.OpenFlags.directory,
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
            case Types.EditType.Rename:
              try {
                const opID = makeUUID()
                await RPCTypes.SimpleFSSimpleFSMoveRpcPromise({
                  dest: pathToRPCPath(Types.pathConcat(edit.parentPath, edit.name)),
                  opID,
                  overwriteExistingFiles: false,
                  src: pathToRPCPath(Types.pathConcat(edit.parentPath, edit.originalName)),
                })
                await RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID}, commitEditWaitingKey)
                get().dispatch.editSuccess(editID)
                return
              } catch (error) {
                if (!(error instanceof RPCError)) {
                  return
                }
                if (
                  [
                    RPCTypes.StatusCode.scsimplefsnameexists,
                    RPCTypes.StatusCode.scsimplefsdirnotempty,
                  ].includes(error.code)
                ) {
                  get().dispatch.editError(editID, error.desc || 'name exists')
                  return
                }
                throw error
              }
          }
        }
        Z.ignorePromise(f())
      },
      discardEdit: (editID: Types.EditID) => {
        set(s => {
          s.edits.delete(editID)
        })
      },
      dismissRedbar: (index: number) => {
        set(s => {
          s.errors = [...s.errors.slice(0, index), ...s.errors.slice(index + 1)]
        })
      },
      driverDisabling: () => {
        set(s => {
          if (s.sfmi.driverStatus.type === Types.DriverStatusType.Enabled) {
            s.sfmi.driverStatus.isDisabling = true
          }
        })
        reduxDispatch(FsGen.createDriverDisabling())
      },
      driverEnable: (isRetry?: boolean) => {
        set(s => {
          if (s.sfmi.driverStatus.type === Types.DriverStatusType.Disabled) {
            s.sfmi.driverStatus.isEnabling = true
          }
        })
        reduxDispatch(FsGen.createDriverEnable({isRetry}))
      },
      driverKextPermissionError: () => {
        set(s => {
          if (s.sfmi.driverStatus.type === Types.DriverStatusType.Disabled) {
            s.sfmi.driverStatus.kextPermissionError = true
            s.sfmi.driverStatus.isEnabling = false
          }
        })
      },
      editError: (editID: Types.EditID, error: string) => {
        set(s => {
          const e = s.edits.get(editID)
          if (e) e.error = error
        })
      },
      editSuccess: (editID: Types.EditID) => {
        set(s => {
          s.edits.delete(editID)
        })
      },
      folderListLoad: (rootPath: Types.Path, isRecursive: boolean) => {
        const f = async () => {
          try {
            const opID = makeUUID()
            if (isRecursive) {
              await RPCTypes.SimpleFSSimpleFSListRecursiveToDepthRpcPromise({
                depth: 1,
                filter: RPCTypes.ListFilter.filterSystemHidden,
                opID,
                path: pathToRPCPath(rootPath),
                refreshSubscription: false,
              })
            } else {
              await RPCTypes.SimpleFSSimpleFSListRpcPromise({
                filter: RPCTypes.ListFilter.filterSystemHidden,
                opID,
                path: pathToRPCPath(rootPath),
                refreshSubscription: false,
              })
            }

            await RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID}, folderListWaitingKey)

            const result = await RPCTypes.SimpleFSSimpleFSReadListRpcPromise({opID})
            const entries = result.entries || []
            const childMap = entries.reduce((m, d) => {
              const [parent, child] = d.name.split('/')
              if (child) {
                // Only add to the children set if the parent definitely has children.
                const fullParent = Types.pathConcat(rootPath, parent)
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
            }, new Map<Types.Path, Set<string>>())

            const direntToPathAndPathItem = (d: RPCTypes.Dirent) => {
              const path = Types.pathConcat(rootPath, d.name)
              const entry = makeEntry(d, childMap.get(path))
              if (entry.type === Types.PathType.Folder && isRecursive && !d.name.includes('/')) {
                // Since we are loading with a depth of 2, first level directories are
                // considered "loaded".
                return [
                  path,
                  {
                    ...entry,
                    progress: Types.ProgressType.Loaded,
                  },
                ] as const
              }
              return [path, entry] as const
            }

            // Get metadata fields of the directory that we just loaded from state to
            // avoid overriding them.
            const rootPathItem = getPathItem(get().pathItems, rootPath)
            const rootFolder: Types.FolderPathItem = {
              ...(rootPathItem.type === Types.PathType.Folder
                ? rootPathItem
                : {...emptyFolder, name: Types.getPathName(rootPath)}),
              children: new Set(childMap.get(rootPath)),
              progress: Types.ProgressType.Loaded,
            }

            const pathItems = new Map<Types.Path, Types.PathItem>([
              ...(Types.getPathLevel(rootPath) > 2 ? [[rootPath, rootFolder] as const] : []),
              ...entries.map(direntToPathAndPathItem),
            ] as const)
            //TODO edit stuff back!!!
            set(s => {
              pathItems.forEach((pathItemFromAction, path) => {
                const oldPathItem = getPathItem(s.pathItems, path)
                const newPathItem = updatePathItem(oldPathItem, pathItemFromAction)
                oldPathItem.type === Types.PathType.Folder &&
                  oldPathItem.children.forEach(
                    name =>
                      (newPathItem.type !== Types.PathType.Folder || !newPathItem.children.has(name)) &&
                      s.pathItems.delete(Types.pathConcat(path, name))
                  )
                s.pathItems.set(path, newPathItem)
              })

              // Remove Rename edits that are for path items that don't exist anymore in
              // case when/if a new item is added later the edit causes confusion.
              const newEntries = [...s.edits.entries()].filter(([_, edit]) => {
                if (edit.type !== Types.EditType.Rename) {
                  return true
                }
                const parent = getPathItem(s.pathItems, edit.parentPath)
                if (parent.type === Types.PathType.Folder && parent.children.has(edit.name)) {
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
        Z.ignorePromise(f())
      },
      kbfsDaemonOnlineStatusChanged: (onlineStatus: RPCTypes.KbfsOnlineStatus) => {
        set(s => {
          s.kbfsDaemonStatus.onlineStatus =
            onlineStatus === RPCTypes.KbfsOnlineStatus.offline
              ? Types.KbfsDaemonOnlineStatus.Offline
              : onlineStatus === RPCTypes.KbfsOnlineStatus.trying
              ? Types.KbfsDaemonOnlineStatus.Trying
              : onlineStatus === RPCTypes.KbfsOnlineStatus.online
              ? Types.KbfsDaemonOnlineStatus.Online
              : Types.KbfsDaemonOnlineStatus.Unknown
        })
      },
      kbfsDaemonRpcStatusChanged: (rpcStatus: Types.KbfsDaemonRpcStatus) => {
        set(s => {
          if (rpcStatus !== Types.KbfsDaemonRpcStatus.Connected) {
            s.kbfsDaemonStatus.onlineStatus = Types.KbfsDaemonOnlineStatus.Offline
          }
          s.kbfsDaemonStatus.rpcStatus = rpcStatus
        })
        reduxDispatch(FsGen.createKbfsDaemonRpcStatusChanged())
      },
      loadFileContext: (path: Types.Path) => {
        const f = async () => {
          try {
            const res = await RPCTypes.SimpleFSSimpleFSGetGUIFileContextRpcPromise({
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
        Z.ignorePromise(f())
      },
      loadPathMetadata: (path: Types.Path) => {
        const f = async () => {
          try {
            const dirent = await RPCTypes.SimpleFSSimpleFSStatRpcPromise(
              {
                path: pathToRPCPath(path),
                refreshSubscription: false,
              },
              statWaitingKey
            )

            const pathItem = makeEntry(dirent)
            set(s => {
              const oldPathItem = getPathItem(s.pathItems, path)
              s.pathItems.set(path, updatePathItem(oldPathItem, pathItem))
              s.softErrors.pathErrors.delete(path)
              s.softErrors.tlfErrors.delete(path)
            })
          } catch (err) {
            errorToActionOrThrow(err, path)
            return
          }
        }
        Z.ignorePromise(f())
      },
      loadSettings: () => {
        const f = async () => {
          set(s => {
            s.settings.isLoading = true
          })
          try {
            const settings = await RPCTypes.SimpleFSSimpleFSSettingsRpcPromise()
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
        Z.ignorePromise(f())
      },
      loadedDownloadInfo: (downloadID: string, info: Types.DownloadInfo) => {
        set(s => {
          s.downloads.info.set(downloadID, info)
        })
      },
      loadedDownloadStatus: (regularDownloads: Array<string>, state: Map<string, Types.DownloadState>) => {
        set(s => {
          s.downloads.regularDownloads = regularDownloads
          s.downloads.state = state

          const toDelete = [...s.downloads.info.keys()].filter(downloadID => !state.has(downloadID))
          if (toDelete.length) {
            toDelete.forEach(downloadID => s.downloads.info.delete(downloadID))
          }
        })
      },
      loadedPathInfo: (path: Types.Path, info: Types.PathInfo) => {
        set(s => {
          s.pathInfos.set(path, info)
        })
      },
      newFolderRow: (parentPath: Types.Path) => {
        const parentPathItem = getPathItem(get().pathItems, parentPath)
        if (parentPathItem.type !== Types.PathType.Folder) {
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
      onChangedFocus: (appFocused: boolean) => {
        const driverStatus = get().sfmi.driverStatus
        if (
          appFocused &&
          driverStatus.type === Types.DriverStatusType.Disabled &&
          driverStatus.kextPermissionError
        ) {
          get().dispatch.driverEnable(true)
        }
      },
      redbar: (error: string) => {
        set(s => {
          s.errors.push(error)
        })
      },
      reset: () => {
        set(() => initialState)
      },
      setBadge: (b: RPCTypes.FilesTabBadge) => {
        set(s => {
          s.badge = b
        })
      },
      setCriticalUpdate: (u: boolean) => {
        set(s => {
          s.criticalUpdate = u
        })
      },
      setDestinationPickerParentPath: (index: number, path: Types.Path) => {
        set(s => {
          s.destinationPicker.destinationParentPath[index] = path
        })
      },
      setDirectMountDir: (directMountDir: string) => {
        set(s => {
          s.sfmi.directMountDir = directMountDir
        })
      },
      setDriverStatus: (driverStatus: Types.DriverStatus) => {
        set(s => {
          s.sfmi.driverStatus = driverStatus
        })
        reduxDispatch(FsGen.createSetDriverStatus())
      },
      setEditName: (editID: Types.EditID, name: string) => {
        set(s => {
          const e = s.edits.get(editID)
          if (e) {
            e.name = name
          }
        })
      },
      setFolderViewFilter: (filter?: string) => {
        set(s => {
          s.folderViewFilter = filter
        })
      },
      setIncomingShareSource: (source: Array<RPCTypes.IncomingShareItem>) => {
        set(s => {
          s.destinationPicker.source = {source, type: Types.DestinationPickerSource.IncomingShare}
        })
      },
      setLastPublicBannerClosedTlf: (tlf: string) => {
        set(s => {
          s.lastPublicBannerClosedTlf = tlf
        })
      },
      setMoveOrCopySource: (path: Types.Path) => {
        set(s => {
          s.destinationPicker.source = {path, type: Types.DestinationPickerSource.MoveOrCopy}
        })
      },
      setPathItemActionMenuDownload: (downloadID?: string, intent?: Types.DownloadIntent) => {
        set(s => {
          s.pathItemActionMenu.downloadID = downloadID
          s.pathItemActionMenu.downloadIntent = intent
        })
      },
      setPathItemActionMenuView: (view: Types.PathItemActionMenuView) => {
        set(s => {
          s.pathItemActionMenu.previousView = s.pathItemActionMenu.view
          s.pathItemActionMenu.view = view
        })
      },
      setPathSoftError: (path: Types.Path, softError?: Types.SoftError) => {
        set(s => {
          if (softError) {
            s.softErrors.pathErrors.set(path, softError)
          } else {
            s.softErrors.pathErrors.delete(path)
          }
        })
      },
      setPreferredMountDirs: (preferredMountDirs: Array<string>) => {
        set(s => {
          s.sfmi.preferredMountDirs = preferredMountDirs
        })
      },
      setSorting: (path: Types.Path, sortSetting: Types.SortSetting) => {
        set(s => {
          const old = s.pathUserSettings.get(path)
          if (old) {
            old.sort = sortSetting
          } else {
            s.pathUserSettings.set(path, {...defaultPathUserSetting, sort: sortSetting})
          }
        })
      },
      setTlfSoftError: (path: Types.Path, softError?: Types.SoftError) => {
        set(s => {
          if (softError) {
            s.softErrors.tlfErrors.set(path, softError)
          } else {
            s.softErrors.tlfErrors.delete(path)
          }
        })
      },
      showIncomingShare: (initialDestinationParentPath: Types.Path) => {
        set(s => {
          if (s.destinationPicker.source.type !== Types.DestinationPickerSource.IncomingShare) {
            s.destinationPicker.source = {source: [], type: Types.DestinationPickerSource.IncomingShare}
          }
          s.destinationPicker.destinationParentPath = [initialDestinationParentPath]
        })
        reduxDispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})
        )
      },
      showMoveOrCopy: (initialDestinationParentPath: Types.Path) => {
        set(s => {
          s.destinationPicker.source =
            s.destinationPicker.source.type === Types.DestinationPickerSource.MoveOrCopy
              ? s.destinationPicker.source
              : {
                  path: defaultPath,
                  type: Types.DestinationPickerSource.MoveOrCopy,
                }

          s.destinationPicker.destinationParentPath = [initialDestinationParentPath]
        })
        reduxDispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})
        )
      },
      startRename: (path: Types.Path) => {
        const parentPath = Types.getPathParent(path)
        const originalName = Types.getPathName(path)
        set(s => {
          s.edits.set(makeEditID(), {
            name: originalName,
            originalName,
            parentPath,
            type: Types.EditType.Rename,
          })
        })
      },
      syncStatusChanged: (status: RPCTypes.FolderSyncStatus) => {
        const diskSpaceStatus = status.outOfSyncSpace
          ? Types.DiskSpaceStatus.Error
          : status.localDiskBytesAvailable < get().settings.spaceAvailableNotificationThreshold
          ? Types.DiskSpaceStatus.Warning
          : Types.DiskSpaceStatus.Ok

        const oldStatus = get().overallSyncStatus.diskSpaceStatus
        set(s => {
          s.overallSyncStatus.syncingFoldersProgress = status.prefetchProgress
          s.overallSyncStatus.diskSpaceStatus = diskSpaceStatus
        })

        // Only notify about the disk space status if it has changed.
        if (oldStatus !== diskSpaceStatus) {
          switch (diskSpaceStatus) {
            case Types.DiskSpaceStatus.Error:
              NotifyPopup('Sync Error', {
                body: 'You are out of disk space. Some folders could not be synced.',
                sound: true,
              })
              reduxDispatch(
                NotificationsGen.createBadgeApp({
                  key: 'outOfSpace',
                  on: status.outOfSyncSpace,
                })
              )
              break
            case Types.DiskSpaceStatus.Warning:
              {
                const threshold = humanizeBytes(get().settings.spaceAvailableNotificationThreshold, 0)
                NotifyPopup('Disk Space Low', {
                  body: `You have less than ${threshold} of storage space left.`,
                })
                // Only show the banner if the previous state was OK and the new state
                // is warning. Otherwise we rely on the previous state of the banner.
                if (oldStatus === Types.DiskSpaceStatus.Ok) {
                  set(s => {
                    s.overallSyncStatus.showingBanner = true
                  })
                }
              }
              break
            case Types.DiskSpaceStatus.Ok:
              break
            default:
          }
        }
      },
      userFileEditsLoad: () => {
        const f = async () => {
          try {
            const writerEdits = await RPCTypes.SimpleFSSimpleFSUserEditHistoryRpcPromise()
            set(s => {
              s.tlfUpdates = userTlfHistoryRPCToState(writerEdits || [])
            })
          } catch (error) {
            errorToActionOrThrow(error)
            return
          }
        }
        Z.ignorePromise(f())
      },
      waitForKbfsDaemon: () => {
        set(s => {
          s.kbfsDaemonStatus.rpcStatus = Types.KbfsDaemonRpcStatus.Waiting
        })
        const f = async () => {
          if (waitForKbfsDaemonInProgress) {
            return
          }
          waitForKbfsDaemonInProgress = true
          try {
            await RPCTypes.configWaitForClientRpcPromise({
              clientType: RPCTypes.ClientType.kbfs,
              timeout: 60, // 1min. This is arbitrary since we're gonna check again anyway if we're not connected.
            })
          } catch (_) {}

          waitForKbfsDaemonInProgress = false
          get().dispatch.checkKbfsDaemonRpcStatus()
        }
        Z.ignorePromise(f())
      },
    }

    return {
      ...initialState,
      dispatch,
      getUploadIconForFilesTab,
    }
  })
)
