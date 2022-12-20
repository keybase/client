import * as Types from './types/fs'
import * as RPCTypes from './types/rpc-gen'
import * as FsGen from '../actions/fs-gen'
import * as Tabs from './tabs'
import * as SettingsConstants from './settings'
import type {TypedState} from '../util/container'
import {isLinux, isMobile} from './platform'
import * as RouteTreeGen from '../actions/route-tree-gen'
import type {TypedActions} from '../actions/typed-actions-gen'

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
  downloadID: null,
  downloadIntent: null,
  previousView: Types.PathItemActionMenuView.Root,
  view: Types.PathItemActionMenuView.Root,
}

export const driverStatusUnknown: Types.DriverStatusUnknown = {
  type: Types.DriverStatusType.Unknown,
} as const

export const emptyDriverStatusEnabled: Types.DriverStatusEnabled = {
  dokanOutdated: false,
  dokanUninstallExecPath: null,
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
): Types.DownloadIntent | null => {
  const found = [...downloads.info].find(([_, info]) => info.path === path)
  if (!found) {
    return null
  }
  const [downloadID] = found
  const dlState = downloads.state.get(downloadID) || emptyDownloadState
  if (!downloadIsOngoing(dlState)) {
    return null
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

export const folderRPCFromPath = (path: Types.Path): RPCTypes.FolderHandle | null => {
  const pathElems = Types.getPathElements(path)
  if (pathElems.length === 0) return null

  const visibility = Types.getVisibilityFromElems(pathElems)
  if (visibility === null) return null

  const name = Types.getPathNameFromElems(pathElems)
  if (name === '') return null

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

export const syntheticEventToTargetRect = (evt?: React.SyntheticEvent): ClientRect | null =>
  isMobile ? null : evt ? (evt.target as HTMLElement).getBoundingClientRect() : null

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

export const getTlfPath = (path: Types.Path): Types.Path | null => {
  const elems = Types.getPathElements(path)
  return elems.length > 2 ? Types.pathConcat(Types.pathConcat(defaultPath, elems[1]), elems[2]) : null
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
  if (resetParticipants.findIndex(username => username === state.config.username) >= 0) {
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

export const getUploadIconForFilesTab = (badge: RPCTypes.FilesTabBadge): Types.UploadIcon | undefined => {
  switch (badge) {
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
): ReadonlyArray<TypedActions> =>
  [
    FsGen.createSetDestinationPickerParentPath({
      index,
      path,
    }),
    navigateAppend({
      path: [{props: {headerRightButton, index}, selected: 'destinationPicker'}],
    }),
  ] as const

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

export const getSoftError = (softErrors: Types.SoftErrors, path: Types.Path): Types.SoftError | null => {
  const pathError = softErrors.pathErrors.get(path)
  if (pathError) {
    return pathError
  }
  if (!softErrors.tlfErrors.size) {
    return null
  }
  const tlfPath = getTlfPath(path)
  return (tlfPath && softErrors.tlfErrors.get(tlfPath)) || null
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
