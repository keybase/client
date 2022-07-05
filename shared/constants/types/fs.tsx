import * as RPCTypes from './rpc-gen'
import * as Devices from './devices'
import {isWindows} from '../platform'
import {memoize} from '../../util/memoize'
// lets not create cycles in flow, lets discuss how to fix this
// import {type Actions} from '../../actions/fs-gen'

export type Path = string | null

export enum PathType {
  Folder = 'folder',
  File = 'file',
  Symlink = 'symlink',
  Unknown = 'unknown',
}
export enum ProgressType {
  Pending = 'pending',
  Loaded = 'loaded',
}

export type Device = {
  readonly type: Devices.DeviceType
  readonly name: string
  readonly deviceID: string
}

export type ParticipantUnlock = {
  readonly name: string
  readonly devices: string
}

export type ResetMember = {
  readonly username: string
  readonly uid: string
}

// TODO: make structs above immutable

export enum TlfType {
  Public = 'public',
  Private = 'private',
  Team = 'team',
}

export const getTlfTypePathFromTlfType = (tlfType: TlfType): Path => {
  switch (tlfType) {
    case TlfType.Public:
      return '/keybase/public'
    case TlfType.Private:
      return '/keybase/private'
    case TlfType.Team:
      return '/keybase/team'
  }
}

export const getTlfTypeFromPath = (path: Path): undefined | TlfType => {
  const str = pathToString(path)
  return str.startsWith('/keybase/private')
    ? TlfType.Private
    : str.startsWith('/keybase/public')
    ? TlfType.Public
    : str.startsWith('/keybase/team')
    ? TlfType.Team
    : undefined
}

export enum TlfSyncMode {
  Enabled = 'enabled',
  Disabled = 'disabled',
  Partial = 'partial',
}

export type TlfSyncEnabled = {
  readonly mode: TlfSyncMode.Enabled
}

export type TlfSyncDisabled = {
  readonly mode: TlfSyncMode.Disabled
}

export type TlfSyncPartial = {
  readonly mode: TlfSyncMode.Partial
  readonly enabledPaths: Array<Path>
}

export type TlfSyncConfig = TlfSyncEnabled | TlfSyncDisabled | TlfSyncPartial

export enum ConflictStateType {
  NormalView = 'manual-server-view',
  ManualResolvingLocalView = 'manual-resolving-local-view',
}

export type ConflictStateNormalView = {
  readonly localViewTlfPaths: Array<Path>
  readonly resolvingConflict: boolean
  readonly stuckInConflict: boolean
  readonly type: ConflictStateType.NormalView
}

export type ConflictStateManualResolvingLocalView = {
  readonly normalViewTlfPath: Path
  readonly type: ConflictStateType.ManualResolvingLocalView
}

export type ConflictState = ConflictStateNormalView | ConflictStateManualResolvingLocalView

export type Tlf = {
  readonly conflictState: ConflictState
  readonly isFavorite: boolean
  readonly isIgnored: boolean
  readonly isNew: boolean
  readonly name: string
  readonly resetParticipants: Array<string> // usernames
  readonly syncConfig: TlfSyncConfig
  readonly teamId: RPCTypes.TeamID
  readonly tlfMtime: number // tlf mtime stored in core db based on notification from mdserver
  /*
   * Disabled because SimpleFS API doesn't have problem_set yet. We might never
   * need these.
   *
   * needsRekey: boolean
   *
   * // Following two fields are calculated but not in-use today yet.
   * //
   * // waitingForParticipantUnlock is the list of participants that can unlock
   * // this folder, when this folder needs a rekey.
   * waitingForParticipantUnlock?: I.List<ParticipantUnlock>
   * // youCanUnlock has a list of devices that can unlock this folder, when this
   * // folder needs a rekey.
   * youCanUnlock?: I.List<Device>
   */
}

// name -> Tlf
export type TlfList = Map<string, Tlf>

export type Tlfs = {
  // additionalTlfs includes Tlfs that we care about but are not in one of
  // private, public, team. This could include Tlfs that are referenced by
  // non-preferred paths, such as /keybase/private/me,z,a or
  // /keybase/private/a,me, or /keybase/private/me@twitter.
  //
  // Note that this is orthogonal to the TLFs added to fav list that are just
  // for conflict resolutions.
  //
  // additionalTlfs should always have lower-priority than the three lists
  // (private, public, team). In other words, check those first.
  readonly additionalTlfs: Map<Path, Tlf>
  readonly loaded: boolean
  readonly private: TlfList
  readonly public: TlfList
  readonly team: TlfList
}

export enum PathKind {
  Root = 'root',
  TlfList = 'tlf-list',
  GroupTlf = 'group-tlf',
  TeamTlf = 'team-tlf',
  InGroupTlf = 'in-group-tlf',
  InTeamTlf = 'in-team-tlf',
}

export type ParsedPathRoot = {
  readonly kind: PathKind.Root
}

export type ParsedPathTlfList = {
  readonly kind: PathKind.TlfList
  readonly tlfType: TlfType
}

export type ParsedPathGroupTlf = {
  readonly kind: PathKind.GroupTlf
  readonly tlfName: string
  readonly tlfType: TlfType.Private | TlfType.Public
  readonly writers: Array<string>
  readonly readers?: Array<string>
}

export type ParsedPathTeamTlf = {
  readonly kind: PathKind.TeamTlf
  readonly tlfName: string
  readonly tlfType: TlfType.Team
  readonly team: string
}

export type ParsedPathInGroupTlf = {
  readonly kind: PathKind.InGroupTlf
  readonly tlfName: string
  readonly tlfType: TlfType.Private | TlfType.Public
  readonly writers: Array<string>
  readonly readers?: Array<string>
  readonly rest: Array<string>
}

export type ParsedPathInTeamTlf = {
  readonly kind: PathKind.InTeamTlf
  readonly tlfName: string
  readonly tlfType: TlfType.Team
  readonly team: string
  readonly rest: Array<string>
}

export type ParsedPath =
  | ParsedPathRoot
  | ParsedPathTlfList
  | ParsedPathGroupTlf
  | ParsedPathTeamTlf
  | ParsedPathInGroupTlf
  | ParsedPathInTeamTlf

export enum PrefetchState {
  NotStarted = 'not-started',
  InProgress = 'in-progress',
  Complete = 'complete',
}

export type PrefetchNotStarted = {
  readonly state: PrefetchState.NotStarted
}

export type PrefetchInProgress = {
  readonly state: PrefetchState.InProgress
  readonly startTime: number
  readonly endEstimate: number
  readonly bytesTotal: number
  readonly bytesFetched: number
}

export type PrefetchComplete = {
  readonly state: PrefetchState.Complete
}

export type PrefetchStatus = PrefetchNotStarted | PrefetchInProgress | PrefetchComplete

type _PathItemMetadata = {
  name: string
  lastModifiedTimestamp: number
  size: number
  lastWriter: string
  writable: boolean
  prefetchStatus: PrefetchStatus
}

export type FolderPathItem = {
  readonly type: PathType.Folder
  readonly children: Set<string>
  readonly progress: ProgressType
} & _PathItemMetadata

export type SymlinkPathItem = {
  readonly type: PathType.Symlink
  readonly linkTarget: string
} & _PathItemMetadata

export type FilePathItem = {
  readonly type: PathType.File
} & _PathItemMetadata

export type UnknownPathItem = {
  readonly type: PathType.Unknown
} & _PathItemMetadata

export type PathItem = FolderPathItem | SymlinkPathItem | FilePathItem | UnknownPathItem

export enum UploadIcon {
  AwaitingToUpload = 'awaiting-to-upload', // has local changes but we're offline
  Uploading = 'uploading', // flushing or writing into journal and we're online
  UploadingStuck = 'uploading-stuck', // flushing or writing into journal but we are stuck in conflict resolution
}

export enum NonUploadStaticSyncStatus {
  Unknown = 'unknown', // trying to figure out what it is
  AwaitingToSync = 'awaiting-to-sync', // sync enabled but we're offline
  OnlineOnly = 'online-only', // sync disabled
  Synced = 'synced', // sync enabled and fully synced
  SyncError = 'sync-error', // uh oh
}
export type SyncStatusStatic = UploadIcon | NonUploadStaticSyncStatus
export const LocalConflictStatus = 'local-conflict'
export type LocalConflictStatus = typeof LocalConflictStatus
export type PathStatusIcon = LocalConflictStatus | SyncStatusStatic | number // percentage<1. not uploading, and we're syncing down

export type EditID = string
export enum EditType {
  NewFolder = 'new-folder',
  Rename = 'rename',
}
export type Edit = {
  readonly type: EditType
  readonly parentPath: Path
  readonly name: string
  // For new folders, this is the automatically generated hint.
  readonly originalName: string
  readonly error?: string
}

export enum SortSetting {
  NameAsc = 'name-asc',
  NameDesc = 'name-desc',
  TimeAsc = 'time-asc',
  TimeDesc = 'time-desc',
}

export type PathUserSetting = {
  readonly sort: SortSetting
}

export type LocalPath = string

export enum DownloadIntent {
  None = 'none',
  CameraRoll = 'camera-roll',
  Share = 'share',
}

export type DownloadState = {
  readonly canceled: boolean
  readonly done: boolean
  readonly endEstimate: number
  readonly error: string
  readonly localPath: string
  readonly progress: number
}

export type DownloadInfo = {
  readonly filename: string
  readonly isRegularDownload: boolean
  readonly path: Path
  readonly startTime: number
}

export type Downloads = {
  readonly info: Map<string, DownloadInfo>
  readonly regularDownloads: Array<string>
  readonly state: Map<string, DownloadState>
}

export type Uploads = {
  readonly writingToJournal: Map<Path, RPCTypes.UploadState>
  readonly totalSyncingBytes: number
  readonly endEstimate?: number
  readonly syncingPaths: Set<Path>
}

// 'both' is only supported on macOS
export enum OpenDialogType {
  File = 'file',
  Directory = 'directory',
  Both = 'both',
}
export enum MobilePickType {
  Photo = 'photo',
  Video = 'video',
  Mixed = 'mixed',
}

export enum FileEditType {
  Created = 'created',
  Modified = 'modified',
  Deleted = 'deleted',
  Renamed = 'renamed',
  Unknown = 'unknown',
}

export type TlfEdit = {
  readonly filename: string
  readonly serverTime: number
  readonly editType: FileEditType
}

export type TlfUpdate = {
  readonly path: Path
  readonly writer: string
  readonly serverTime: number
  readonly history: Array<TlfEdit>
}

export type UserTlfUpdates = Array<TlfUpdate>

export type PathItems = Map<Path, PathItem>

export type Edits = Map<EditID, Edit>

export enum DestinationPickerSource {
  None = 'none',
  MoveOrCopy = 'move-or-copy',
  IncomingShare = 'incoming-share',
}

export type MoveOrCopySource = {
  readonly type: DestinationPickerSource.MoveOrCopy
  readonly path: Path
}

export type IncomingShareSource = {
  readonly type: DestinationPickerSource.IncomingShare
  readonly source: Array<RPCTypes.IncomingShareItem>
}

export type NoSource = {
  readonly type: DestinationPickerSource.None
}

export type DestinationPicker = {
  // id -> Path mapping. This is useful for mobile when we have multiple layers
  // stacked on top of each other, and we need to keep track of them for the
  // back button. We don't put this in routeProps directly as that'd
  // complicate stuff for desktop because we don't have something like a
  // routeToSibling.
  readonly destinationParentPath: Array<Path>
  readonly source: MoveOrCopySource | IncomingShareSource | NoSource
}

export enum PathItemActionMenuView {
  Root = 'root',
  Share = 'share',
  ConfirmSaveMedia = 'confirm-save-media',
  ConfirmSendToOtherApp = 'confirm-send-to-other-app',
}
export type PathItemActionMenu = {
  readonly downloadID: string | null
  readonly downloadIntent: DownloadIntent | null
  readonly previousView: PathItemActionMenuView
  readonly view: PathItemActionMenuView
}

export enum DriverStatusType {
  Unknown = 'unknown',
  Disabled = 'disabled',
  Enabled = 'enabled',
}
export type DriverStatusUnknown = {
  readonly type: DriverStatusType.Unknown
}

export type DriverStatusDisabled = {
  readonly type: DriverStatusType.Disabled
  readonly isEnabling: boolean
  // macOS only
  readonly kextPermissionError: boolean
}

export type DriverStatusEnabled = {
  readonly type: DriverStatusType.Enabled
  readonly isDisabling: boolean
  // windows only
  readonly dokanOutdated: boolean
  readonly dokanUninstallExecPath?: string | null
}

export type DriverStatus = DriverStatusUnknown | DriverStatusDisabled | DriverStatusEnabled

export type SystemFileManagerIntegration = {
  readonly directMountDir: string
  readonly driverStatus: DriverStatus
  readonly preferredMountDirs: Array<string>
}

export enum KbfsDaemonRpcStatus {
  Connected = 'connected',
  Waiting = 'waiting',
}
export enum KbfsDaemonOnlineStatus {
  Unknown = 'unknown',
  Offline = 'offline',
  Trying = 'trying',
  Online = 'online',
}
export type KbfsDaemonStatus = {
  readonly rpcStatus: KbfsDaemonRpcStatus
  readonly onlineStatus: KbfsDaemonOnlineStatus
}

export type SyncingFoldersProgress = {
  readonly bytesFetched: number
  readonly bytesTotal: number
  readonly endEstimate: number
  readonly start: number
}

export enum DiskSpaceStatus {
  Ok = 'ok',
  Warning = 'warning',
  Error = 'error',
}
export type OverallSyncStatus = {
  readonly syncingFoldersProgress: SyncingFoldersProgress
  readonly diskSpaceStatus: DiskSpaceStatus
  // showingBanner tracks whether we need to show the banner.
  // It's mostly derived from diskSpaceStatus above, but it has to appear
  // in the state since the user can dismiss it.
  readonly showingBanner: boolean
}

export enum SoftError {
  NoAccess = 'no-access',
  Nonexistent = 'non-existent',
}

export type SoftErrors = {
  readonly pathErrors: Map<Path, SoftError>
  readonly tlfErrors: Map<Path, SoftError>
}

export type Settings = {
  readonly isLoading: boolean
  readonly loaded: boolean
  readonly sfmiBannerDismissed: boolean
  readonly spaceAvailableNotificationThreshold: number
  readonly syncOnCellular: boolean
}

export type PathInfo = {
  readonly deeplinkPath: string
  readonly platformAfterMountPath: string
}

export type FileContext = {
  readonly contentType: string
  readonly viewType: RPCTypes.GUIViewType
  readonly url: string
}

export type State = {
  readonly badge: RPCTypes.FilesTabBadge
  readonly criticalUpdate: boolean
  readonly destinationPicker: DestinationPicker
  readonly downloads: Downloads
  readonly edits: Edits
  readonly errors: Array<string>
  readonly fileContext: Map<Path, FileContext>
  readonly folderViewFilter: string | null // on mobile, '' is exapnded empty, null is unexpanded
  readonly kbfsDaemonStatus: KbfsDaemonStatus
  readonly lastPublicBannerClosedTlf: string
  readonly overallSyncStatus: OverallSyncStatus
  readonly pathItemActionMenu: PathItemActionMenu
  readonly pathItems: PathItems
  readonly pathInfos: Map<Path, PathInfo>
  readonly pathUserSettings: Map<Path, PathUserSetting>
  readonly settings: Settings
  readonly sfmi: SystemFileManagerIntegration
  readonly softErrors: SoftErrors
  readonly tlfUpdates: UserTlfUpdates
  readonly tlfs: Tlfs
  readonly uploads: Uploads
}

export type Visibility = TlfType | null

export const direntToPathType = (d: RPCTypes.Dirent): PathType => {
  switch (d.direntType) {
    case RPCTypes.DirentType.dir:
      return PathType.Folder
    case RPCTypes.DirentType.sym:
      return PathType.Symlink
    case RPCTypes.DirentType.file:
    case RPCTypes.DirentType.exec:
      return PathType.File
    default:
      return PathType.Unknown
  }
}
export const getPathFromRelative = (tlfName: string, tlfType: TlfType, inTlfPath: string): Path =>
  '/keybase/' + tlfType + '/' + tlfName + '/' + inTlfPath
export const stringToEditID = (s: string): EditID => s
export const editIDToString = (s: EditID): string => s
export const stringToPath = (s: string): Path =>
  s.indexOf('/') === 0 ? s.replace(/\/+/g, '/').replace(/\/$/, '') : null
export const pathToString = (p: Path): string => (!p ? '' : p)
export const stringToLocalPath = (s: string): LocalPath => s
export const localPathToString = (p: LocalPath): string => p
export const getPathName = (p: Path): string => (!p ? '' : p.split('/').pop() || '')
export const getPathNameFromElems = (elems: Array<string>): string => {
  if (elems.length === 0) return ''
  return elems[elems.length - 1]
}
export const getPathLevel = (p: Path): number => (!p ? 0 : getPathElements(p).length)
export const getPathParent = (p: Path): Path =>
  !p
    ? ''
    : p
        .split('/')
        .slice(0, -1)
        .join('/')
export const getPathElements = memoize((p: Path): Array<string> => (!p ? [] : p.split('/').slice(1)))
export const getPathFromElements = (elems: Array<string>): Path => [''].concat(elems).join('/')
export const getVisibilityFromElems = (elems: Array<string>) => {
  if (elems.length < 2 || !elems[1]) return null
  const visibility = elems[1]
  switch (visibility) {
    case 'private':
      return TlfType.Private
    case 'public':
      return TlfType.Public
    case 'team':
      return TlfType.Team
    default:
      // We don't do a flow check here because by now flow knows that we can't
      // be an empty string, so asserting empty will always fail.
      return null
  }
}
export const pathsAreInSameTlf = (path1: Path, path2: Path) =>
  getPathElements(path1)
    .slice(0, 3)
    .join('/') ===
  getPathElements(path2)
    .slice(0, 3)
    .join('/')
export const getRPCFolderTypeFromVisibility = (v: Visibility): RPCTypes.FolderType => {
  if (v === null) return RPCTypes.FolderType.unknown
  return RPCTypes.FolderType[v]
}
export const getVisibilityFromRPCFolderType = (folderType: RPCTypes.FolderType): Visibility => {
  switch (folderType) {
    case RPCTypes.FolderType.private:
      return TlfType.Private
    case RPCTypes.FolderType.public:
      return TlfType.Public
    case RPCTypes.FolderType.team:
      return TlfType.Team
    default:
      return null
  }
}
export const getPathVisibility = (p: Path): Visibility => {
  const elems = getPathElements(p)
  return getVisibilityFromElems(elems)
}
export const stringToPathType = (s: string): PathType => {
  switch (s) {
    case 'folder':
      return PathType.Folder
    case 'file':
      return PathType.File
    case 'symlink':
      return PathType.Symlink
    case 'unknown':
      return PathType.Unknown
    default:
      // We don't do a flow check here because by now flow knows that we can't
      // be an empty string, so asserting empty will always fail.
      throw new Error('Invalid path type')
  }
}
export const pathTypeToString = (p: PathType): string => {
  switch (p) {
    case PathType.Unknown:
      return 'unknown'
    case PathType.Symlink:
      return 'symlink'
    case PathType.File:
      return 'file'
    case PathType.Folder:
      return 'folder'
    default:
      throw new Error('Invalid path type')
  }
}
export const pathConcat = (p: Path, s: string): Path =>
  s === '' ? p : p === '/' ? stringToPath('/' + s) : stringToPath(pathToString(p) + '/' + s)
export const pathIsNonTeamTLFList = (p: Path): boolean => {
  const str = pathToString(p)
  return str === '/keybase/private' || str === '/keybase/public'
}
export const getPathDir = (p: Path): Path => pathToString(p).slice(0, pathToString(p).lastIndexOf('/'))

const localSep = isWindows ? '\\' : '/'

export const localPathConcat = (p: LocalPath, s: string): LocalPath => p + localSep + s
export const getLocalPathName = (localPath: LocalPath): string => {
  const elems = localPath.split(localSep)
  for (let elem = elems.pop(); elems.length; elem = elems.pop()) {
    if (elem) {
      return elem
    }
  }
  return ''
}
export const getLocalPathDir = (p: LocalPath): string => p.slice(0, p.lastIndexOf(localSep))

// SimpleFS always uses forward slashes for local paths. So we need to convert
// them on Windows before sending over.
// TODO: move this conversion to Go side
export const getNormalizedLocalPath = (p: LocalPath): LocalPath =>
  localSep === '\\' ? p.replace(/\\/g, '/') : p

export type PathBreadcrumbItem = {
  isTeamTlf: boolean
  isLastItem: boolean
  name: string
  path: Path
  onClick: (evt?: React.SyntheticEvent) => void
}

export type FolderRPCWithMeta = {
  name: string
  folderType: RPCTypes.FolderType
  isIgnored: boolean
  isNew: boolean
  needsRekey: boolean
  waitingForParticipantUnlock?: Array<ParticipantUnlock>
  youCanUnlock?: Array<Device>
  team_id: string | null
  reset_members: Array<ResetMember> | null
}

export type FavoriteFolder = {
  readonly name: string
  readonly private: boolean
  readonly folderType: RPCTypes.FolderType
  readonly problem_set?: {
    solution_kids: {[K in string]: Array<string>}
    can_self_help: boolean
  }
  readonly team_id: string | null
  readonly reset_members: Array<ResetMember> | null
}

export enum FileViewType {
  Text = 'text',
  Image = 'image',
  Av = 'av',
  Pdf = 'pdf',
  Default = 'default',
}

export type ResetMetadata = {
  readonly name: string
  readonly visibility: Visibility
  readonly resetParticipants: Array<string>
}

export enum NonUploadPathItemBadgeType {
  Download = 'download',
}
export type PathItemBadge = UploadIcon | NonUploadPathItemBadgeType | number

export enum ResetBannerNoOthersType {
  None = 'none',
  Self = 'self',
}
export type ResetBannerType = ResetBannerNoOthersType | number
export enum MainBannerType {
  None = 'none',
  Offline = 'offline',
  TryingToConnect = 'trying-to-connect',
  OutOfSpace = 'out-of-space',
}
