import * as T from '@/constants/types'
import {isLinux, isMobile} from '@/constants/platform'
import {navigateAppend} from '@/constants/router2'

// Prefetch Constants
const prefetchNotStarted: T.FS.PrefetchNotStarted = {
  state: T.FS.PrefetchState.NotStarted,
}

const prefetchComplete: T.FS.PrefetchComplete = {
  state: T.FS.PrefetchState.Complete,
}

export {prefetchNotStarted, prefetchComplete}

export const navToPath = (
  // TODO: remove the second arg when we are done with migrating to nav2
  path: T.FS.Path
) => {
  navigateAppend({props: {path}, selected: 'fsRoot'})
}

// Path Constants
export const defaultPath = T.FS.stringToPath('/keybase')

// PathItem Constants
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

// Factory Functions
export const unknownTlf = (() => {
  const tlfSyncDisabled: T.FS.TlfSyncDisabled = {
    mode: T.FS.TlfSyncMode.Disabled,
  }
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
  const makeTlf = (p: Partial<T.FS.Tlf>): T.FS.Tlf => {
    const {
      conflictState,
      isFavorite,
      isIgnored,
      isNew,
      name,
      resetParticipants,
      syncConfig,
      teamId,
      tlfMtime,
    } = p
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
  return makeTlf({})
})()

// Empty/Default Objects
export const emptyNewFolder: T.FS.Edit = {
  error: undefined,
  name: 'New Folder',
  originalName: 'New Folder',
  parentPath: T.FS.stringToPath('/keybase'),
  type: T.FS.EditType.NewFolder,
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

// Driver Status Constants
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

// Parsed Path Constants
const parsedPathRoot: T.FS.ParsedPathRoot = {kind: T.FS.PathKind.Root}

const parsedPathPrivateList: T.FS.ParsedPathTlfList = {
  kind: T.FS.PathKind.TlfList,
  tlfType: T.FS.TlfType.Private,
}

const parsedPathPublicList: T.FS.ParsedPathTlfList = {
  kind: T.FS.PathKind.TlfList,
  tlfType: T.FS.TlfType.Public,
}

const parsedPathTeamList: T.FS.ParsedPathTlfList = {
  kind: T.FS.PathKind.TlfList,
  tlfType: T.FS.TlfType.Team,
}

// Conversion Functions
export const pathToRPCPath = (
  path: T.FS.Path
): {PathType: T.RPCGen.PathType.kbfs; kbfs: T.RPCGen.KBFSPath} => ({
  PathType: T.RPCGen.PathType.kbfs,
  kbfs: {
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.fsGui,
    path: T.FS.pathToString(path).substring('/keybase'.length) || '/',
  },
})

// Path/PathItem Utilities
export const pathTypeToTextType = (type: T.FS.PathType) =>
  type === T.FS.PathType.Folder ? 'BodySemibold' : 'Body'

export const getPathItem = (
  pathItems: T.Immutable<Map<T.FS.Path, T.FS.PathItem>>,
  path: T.Immutable<T.FS.Path>
): T.Immutable<T.FS.PathItem> => pathItems.get(path) || (unknownPathItem as T.FS.PathItem)

export const getTlfPath = (path: T.FS.Path): T.FS.Path => {
  const elems = T.FS.getPathElements(path)
  return elems.length > 2 ? T.FS.pathConcat(T.FS.pathConcat(defaultPath, elems[1]!), elems[2]!) : undefined
}

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

export const getUploadedPath = (parentPath: T.FS.Path, localPath: string) =>
  T.FS.pathConcat(parentPath, T.FS.getLocalPathName(localPath))

export const pathsInSameTlf = (a: T.FS.Path, b: T.FS.Path): boolean => {
  const elemsA = T.FS.getPathElements(a)
  const elemsB = T.FS.getPathElements(b)
  return elemsA.length >= 3 && elemsB.length >= 3 && elemsA[1] === elemsB[1] && elemsA[2] === elemsB[2]
}

const slashKeybaseSlashLength = '/keybase/'.length
export const escapePath = (path: T.FS.Path): string =>
  'keybase://' +
  encodeURIComponent(T.FS.pathToString(path).slice(slashKeybaseSlashLength)).replace(
    // We need to do this because otherwise encodeURIComponent would encode
    // "/"s.
    /%2F/g,
    '/'
  )

export const rebasePathToDifferentTlf = (path: T.FS.Path, newTlfPath: T.FS.Path) =>
  T.FS.pathConcat(newTlfPath, T.FS.getPathElements(path).slice(3).join('/'))

export const isFolder = (path: T.FS.Path, pathItem: T.FS.PathItem) =>
  T.FS.getPathLevel(path) <= 3 || pathItem.type === T.FS.PathType.Folder

export const isInTlf = (path: T.FS.Path) => T.FS.getPathLevel(path) > 2

export const hasPublicTag = (path: T.FS.Path): boolean => {
  const publicPrefix = '/keybase/public/'
  // The slash after public in `publicPrefix` prevents /keybase/public from counting.
  return T.FS.pathToString(path).startsWith(publicPrefix)
}

export const hasSpecialFileElement = (path: T.FS.Path): boolean =>
  T.FS.getPathElements(path).some(elem => elem.startsWith('.kbfs'))

// Username/User Utilities
export const splitTlfIntoUsernames = (tlf: string): ReadonlyArray<string> =>
  tlf.split(' ')[0]?.replace(/#/g, ',').split(',') ?? []

export const getUsernamesFromPath = (path: T.FS.Path): ReadonlyArray<string> => {
  const elems = T.FS.getPathElements(path)
  return elems.length < 3 ? [] : splitTlfIntoUsernames(elems[2]!)
}

export const usernameInPath = (username: string, path: T.FS.Path) => {
  const elems = T.FS.getPathElements(path)
  return elems.length >= 3 && elems[2]!.split(',').includes(username)
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

export const getUsernamesFromTlfName = (tlfName: string): Array<string> => {
  const split = splitTlfIntoReadersAndWriters(tlfName)
  return split.writers.concat(split.readers || [])
}

// TLF/List Utilities
export const computeBadgeNumberForTlfList = (tlfList: T.Immutable<T.FS.TlfList>): number =>
  [...tlfList.values()].reduce((accumulator, tlf) => (tlfIsBadged(tlf) ? accumulator + 1 : accumulator), 0)

export const computeBadgeNumberForAll = (tlfs: T.Immutable<T.FS.Tlfs>): number =>
  [T.FS.TlfType.Private, T.FS.TlfType.Public, T.FS.TlfType.Team]
    .map(tlfType => computeBadgeNumberForTlfList(getTlfListFromType(tlfs, tlfType)))
    .reduce((sum, count) => sum + count, 0)

export const tlfIsBadged = (tlf: T.FS.Tlf) => !tlf.isIgnored && tlf.isNew

export const tlfIsStuckInConflict = (tlf: T.FS.Tlf) =>
  tlf.conflictState.type === T.FS.ConflictStateType.NormalView && tlf.conflictState.stuckInConflict

// Path Parsing
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

// Chat/Share Utilities
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

// File/Download Utilities
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

export const canSaveMedia = (pathItem: T.FS.PathItem, fileContext: T.FS.FileContext): boolean => {
  if (pathItem.type !== T.FS.PathType.File || fileContext === emptyFileContext) {
    return false
  }
  return (
    fileContext.viewType === T.RPCGen.GUIViewType.image || fileContext.viewType === T.RPCGen.GUIViewType.video
  )
}

export const isOfflineUnsynced = (
  daemonStatus: T.FS.KbfsDaemonStatus,
  pathItem: T.FS.PathItem,
  path: T.FS.Path
) =>
  daemonStatus.onlineStatus === T.FS.KbfsDaemonOnlineStatus.Offline &&
  T.FS.getPathLevel(path) > 2 &&
  pathItem.prefetchStatus !== prefetchComplete

// Status/Icon Utilities
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

export const isPathEnabledForSync = (syncConfig: T.FS.TlfSyncConfig, path: T.FS.Path): boolean => {
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

// Settings/Configuration Utilities
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

export const sfmiInfoLoaded = (settings: T.FS.Settings, driverStatus: T.FS.DriverStatus): boolean =>
  settings.loaded && driverStatus !== driverStatusUnknown

export const hideOrDisableInDestinationPicker = (
  tlfType: T.FS.TlfType,
  name: string,
  username: string,
  destinationPickerIndex?: number
) => typeof destinationPickerIndex === 'number' && tlfType === T.FS.TlfType.Public && name !== username

// Other Utilities

export const showIgnoreFolder = (path: T.FS.Path, username?: string): boolean => {
  const elems = T.FS.getPathElements(path)
  if (elems.length !== 3) {
    return false
  }
  return ['public', 'private'].includes(elems[1]!) && elems[2]! !== username
}
