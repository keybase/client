import * as RPCTypes from './rpc-gen'
import type * as Devices from './devices'
import {isWindows} from '../platform'
// lets not create cycles in flow, lets discuss how to fix this
// import {type Actions} from '@/actions/fs-gen'

export type Path = string | undefined

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

export type Device = Readonly<{
  type: Devices.DeviceType
  name: string
  deviceID: string
}>

export type ParticipantUnlock = Readonly<{
  name: string
  devices: string
}>

export type ResetMember = Readonly<{
  username: string
  uid: string
}>

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

export type TlfSyncEnabled = Readonly<{
  mode: TlfSyncMode.Enabled
}>

export type TlfSyncDisabled = Readonly<{
  mode: TlfSyncMode.Disabled
}>

export type TlfSyncPartial = Readonly<{
  mode: TlfSyncMode.Partial
  enabledPaths: ReadonlyArray<Path>
}>

export type TlfSyncConfig = TlfSyncEnabled | TlfSyncDisabled | TlfSyncPartial

export enum ConflictStateType {
  NormalView = 'manual-server-view',
  ManualResolvingLocalView = 'manual-resolving-local-view',
}

export type ConflictStateNormalView = Readonly<{
  localViewTlfPaths: ReadonlyArray<Path>
  resolvingConflict: boolean
  stuckInConflict: boolean
  type: ConflictStateType.NormalView
}>

export type ConflictStateManualResolvingLocalView = Readonly<{
  normalViewTlfPath: Path
  type: ConflictStateType.ManualResolvingLocalView
}>

export type ConflictState = ConflictStateNormalView | ConflictStateManualResolvingLocalView

export type Tlf = Readonly<{
  conflictState: ConflictState
  isFavorite: boolean
  isIgnored: boolean
  isNew: boolean
  name: string
  resetParticipants: ReadonlyArray<string> // usernames
  syncConfig: TlfSyncConfig
  teamId: RPCTypes.TeamID
  tlfMtime: number // tlf mtime stored in core db based on notification from mdserver
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
}>

// name -> Tlf
export type TlfList = ReadonlyMap<string, Tlf>

export type Tlfs = Readonly<{
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
  additionalTlfs: ReadonlyMap<Path, Tlf>
  loaded: boolean
  private: TlfList
  public: TlfList
  team: TlfList
}>

export enum PathKind {
  Root = 'root',
  TlfList = 'tlf-list',
  GroupTlf = 'group-tlf',
  TeamTlf = 'team-tlf',
  InGroupTlf = 'in-group-tlf',
  InTeamTlf = 'in-team-tlf',
}

export type ParsedPathRoot = Readonly<{
  kind: PathKind.Root
}>

export type ParsedPathTlfList = Readonly<{
  kind: PathKind.TlfList
  tlfType: TlfType
}>

export type ParsedPathGroupTlf = Readonly<{
  kind: PathKind.GroupTlf
  tlfName: string
  tlfType: TlfType.Private | TlfType.Public
  writers: ReadonlyArray<string>
  readers?: ReadonlyArray<string>
}>

export type ParsedPathTeamTlf = Readonly<{
  kind: PathKind.TeamTlf
  tlfName: string
  tlfType: TlfType.Team
  team: string
}>

export type ParsedPathInGroupTlf = Readonly<{
  kind: PathKind.InGroupTlf
  tlfName: string
  tlfType: TlfType.Private | TlfType.Public
  writers: ReadonlyArray<string>
  readers?: ReadonlyArray<string>
  rest: ReadonlyArray<string>
}>

export type ParsedPathInTeamTlf = Readonly<{
  kind: PathKind.InTeamTlf
  tlfName: string
  tlfType: TlfType.Team
  team: string
  rest: ReadonlyArray<string>
}>

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

export type PrefetchNotStarted = Readonly<{
  state: PrefetchState.NotStarted
}>

export type PrefetchInProgress = Readonly<{
  state: PrefetchState.InProgress
  startTime: number
  endEstimate: number
  bytesTotal: number
  bytesFetched: number
}>

export type PrefetchComplete = Readonly<{
  state: PrefetchState.Complete
}>

export type PrefetchStatus = PrefetchNotStarted | PrefetchInProgress | PrefetchComplete

type _PathItemMetadata = {
  name: string
  lastModifiedTimestamp: number
  size: number
  lastWriter: string
  writable: boolean
  prefetchStatus: PrefetchStatus
}

export type FolderPathItem = Readonly<{
  type: PathType.Folder
  children: ReadonlySet<string>
  progress: ProgressType
}> &
  _PathItemMetadata

export type SymlinkPathItem = Readonly<{
  type: PathType.Symlink
  linkTarget: string
}> &
  _PathItemMetadata

export type FilePathItem = Readonly<{
  type: PathType.File
}> &
  _PathItemMetadata

export type UnknownPathItem = Readonly<{
  type: PathType.Unknown
}> &
  _PathItemMetadata

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
export type LocalConflictStatusType = typeof LocalConflictStatus
export type PathStatusIcon = LocalConflictStatusType | SyncStatusStatic | number // percentage<1. not uploading, and we're syncing down

export type EditID = string
export enum EditType {
  NewFolder = 'new-folder',
  Rename = 'rename',
}
export type Edit = Readonly<{
  type: EditType
  parentPath: Path
  name: string
  // For new folders, this is the automatically generated hint.
  originalName: string
  error?: string
}>

export enum SortSetting {
  NameAsc = 'name-asc',
  NameDesc = 'name-desc',
  TimeAsc = 'time-asc',
  TimeDesc = 'time-desc',
}

export type PathUserSetting = Readonly<{
  sort: SortSetting
}>

export type LocalPath = string

export enum DownloadIntent {
  None = 'none',
  CameraRoll = 'camera-roll',
  Share = 'share',
}

export type DownloadState = Readonly<{
  canceled: boolean
  done: boolean
  endEstimate: number
  error: string
  localPath: string
  progress: number
}>

export type DownloadInfo = Readonly<{
  filename: string
  isRegularDownload: boolean
  path: Path
  startTime: number
}>

export type Downloads = Readonly<{
  info: ReadonlyMap<string, DownloadInfo>
  regularDownloads: ReadonlyArray<string>
  state: ReadonlyMap<string, DownloadState>
}>

export type Uploads = Readonly<{
  writingToJournal: ReadonlyMap<Path, RPCTypes.UploadState>
  totalSyncingBytes: number
  endEstimate?: number
  syncingPaths: ReadonlySet<Path>
}>

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

export type TlfEdit = Readonly<{
  filename: string
  serverTime: number
  editType: FileEditType
}>

export type TlfUpdate = Readonly<{
  path: Path
  writer: string
  serverTime: number
  history: ReadonlyArray<TlfEdit>
}>

export type UserTlfUpdates = ReadonlyArray<TlfUpdate>

export type PathItems = ReadonlyMap<Path, PathItem>

export type Edits = ReadonlyMap<EditID, Edit>

export enum DestinationPickerSource {
  None = 'none',
  MoveOrCopy = 'move-or-copy',
  IncomingShare = 'incoming-share',
}

export type MoveOrCopySource = Readonly<{
  type: DestinationPickerSource.MoveOrCopy
  path: Path
}>

export type IncomingShareSource = Readonly<{
  type: DestinationPickerSource.IncomingShare
  source: ReadonlyArray<RPCTypes.IncomingShareItem>
}>

export type NoSource = Readonly<{
  type: DestinationPickerSource.None
}>

export type DestinationPicker = Readonly<{
  // id -> Path mapping. This is useful for mobile when we have multiple layers
  // stacked on top of each other, and we need to keep track of them for the
  // back button. We don't put this in routeProps directly as that'd
  // complicate stuff for desktop because we don't have something like a
  // routeToSibling.
  destinationParentPath: ReadonlyArray<Path>
  source: MoveOrCopySource | IncomingShareSource | NoSource
}>

export enum PathItemActionMenuView {
  Root = 'root',
  Share = 'share',
  ConfirmSaveMedia = 'confirm-save-media',
  ConfirmSendToOtherApp = 'confirm-send-to-other-app',
}
export type PathItemActionMenu = Readonly<{
  downloadID: string | undefined
  downloadIntent: DownloadIntent | undefined
  previousView: PathItemActionMenuView
  view: PathItemActionMenuView
}>

export enum DriverStatusType {
  Unknown = 'unknown',
  Disabled = 'disabled',
  Enabled = 'enabled',
}
export type DriverStatusUnknown = Readonly<{
  type: DriverStatusType.Unknown
}>

export type DriverStatusDisabled = Readonly<{
  type: DriverStatusType.Disabled
  isEnabling: boolean
  // macOS only
  kextPermissionError: boolean
}>

export type DriverStatusEnabled = Readonly<{
  type: DriverStatusType.Enabled
  isDisabling: boolean
  // windows only
  dokanOutdated: boolean
  dokanUninstallExecPath?: string
}>

export type DriverStatus = DriverStatusUnknown | DriverStatusDisabled | DriverStatusEnabled

export type SystemFileManagerIntegration = Readonly<{
  directMountDir: string
  driverStatus: DriverStatus
  preferredMountDirs: ReadonlyArray<string>
}>

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
export type KbfsDaemonStatus = Readonly<{
  rpcStatus: KbfsDaemonRpcStatus
  onlineStatus: KbfsDaemonOnlineStatus
}>

export type SyncingFoldersProgress = Readonly<{
  bytesFetched: number
  bytesTotal: number
  endEstimate: number
  start: number
}>

export enum DiskSpaceStatus {
  Ok = 'ok',
  Warning = 'warning',
  Error = 'error',
}
export type OverallSyncStatus = Readonly<{
  syncingFoldersProgress: SyncingFoldersProgress
  diskSpaceStatus: DiskSpaceStatus
  // showingBanner tracks whether we need to show the banner.
  // It's mostly derived from diskSpaceStatus above, but it has to appear
  // in the state since the user can dismiss it.
  showingBanner: boolean
}>

export enum SoftError {
  NoAccess = 'no-access',
  Nonexistent = 'non-existent',
}

export type SoftErrors = Readonly<{
  pathErrors: ReadonlyMap<Path, SoftError>
  tlfErrors: ReadonlyMap<Path, SoftError>
}>

export type Settings = Readonly<{
  isLoading: boolean
  loaded: boolean
  sfmiBannerDismissed: boolean
  spaceAvailableNotificationThreshold: number
  syncOnCellular: boolean
}>

export type PathInfo = Readonly<{
  deeplinkPath: string
  platformAfterMountPath: string
}>

export type FileContext = Readonly<{
  contentType: string
  viewType: RPCTypes.GUIViewType
  url: string
}>

export type Visibility = TlfType | undefined

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
  s.startsWith('/') ? s.replace(/\/+/g, '/').replace(/\/$/, '') : undefined
export const pathToString = (p: Path): string => (!p ? '' : p)
export const stringToLocalPath = (s: string): LocalPath => s
export const localPathToString = (p: LocalPath): string => p
export const getPathName = (p: Path): string => (!p ? '' : p.split('/').pop() || '')
export const getPathNameFromElems = (elems: ReadonlyArray<string>): string => {
  if (elems.length === 0) return ''
  return elems.at(-1)!
}
export const getPathLevel = (p: Path): number => (!p ? 0 : getPathElements(p).length)
export const getPathParent = (p: Path): Path => (!p ? '' : p.split('/').slice(0, -1).join('/'))
export const getPathElements = (p: Path): ReadonlyArray<string> => (!p ? [] : p.split('/').slice(1))
export const getPathFromElements = (elems: ReadonlyArray<string>): Path => [''].concat(elems).join('/')
export const getVisibilityFromElems = (elems: ReadonlyArray<string>) => {
  if (elems.length < 2 || !elems[1]) return undefined
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
      return undefined
  }
}
export const pathsAreInSameTlf = (path1: Path, path2: Path) =>
  getPathElements(path1).slice(0, 3).join('/') === getPathElements(path2).slice(0, 3).join('/')
export const getRPCFolderTypeFromVisibility = (v: Visibility): RPCTypes.FolderType => {
  if (v === undefined) return RPCTypes.FolderType.unknown
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
      return undefined
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
  waitingForParticipantUnlock?: ReadonlyArray<ParticipantUnlock>
  youCanUnlock?: ReadonlyArray<Device>
  team_id?: string
  reset_members?: ReadonlyArray<ResetMember>
}

export type FavoriteFolder = Readonly<{
  name: string
  private: boolean
  folderType: RPCTypes.FolderType
  problem_set?: {
    solution_kids: {[K in string]: ReadonlyArray<string>}
    can_self_help: boolean
  }
  team_id?: string
  reset_members?: ReadonlyArray<ResetMember>
}>

export enum FileViewType {
  Text = 'text',
  Image = 'image',
  Av = 'av',
  Pdf = 'pdf',
  Default = 'default',
}

export type ResetMetadata = Readonly<{
  name: string
  visibility: Visibility
  resetParticipants: ReadonlyArray<string>
}>

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
