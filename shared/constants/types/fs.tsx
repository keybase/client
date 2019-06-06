import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import * as ChatTypes from './chat2'
import * as Devices from './devices'
import * as TeamsTypes from '../../constants/types/teams'
// TODO importing FsGen causes an import loop
import * as FsGen from '../../actions/fs-gen'
import {IconType} from '../../common-adapters/icon.constants'
import {TextType} from '../../common-adapters/text'
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

// not naming Error because it has meaning in js.
export type _FsError = {
  time: number
  errorMessage: string
  erroredAction: FsGen.Actions
  retriableAction?: FsGen.Actions | null
}
export type FsError = I.RecordOf<_FsError>

export type Device = {
  type: Devices.DeviceType
  name: string
  deviceID: string
}

export type ParticipantUnlock = {
  name: string
  devices: string
}

export type ResetMember = {
  username: string
  uid: string
}

// TODO: make structs above immutable

export enum TlfType {
  Public = 'public',
  Private = 'private',
  Team = 'team',
}

export enum TlfSyncMode {
  Enabled = 'enabled',
  Disabled = 'disabled',
  Partial = 'partial',
}

export type _TlfSyncEnabled = {
  mode: TlfSyncMode.Enabled
}
export type TlfSyncEnabled = I.RecordOf<_TlfSyncEnabled>

export type _TlfSyncDisabled = {
  mode: TlfSyncMode.Disabled
}
export type TlfSyncDisabled = I.RecordOf<_TlfSyncDisabled>

export type _TlfSyncPartial = {
  mode: TlfSyncMode.Partial
  enabledPaths: I.List<Path>
}
export type TlfSyncPartial = I.RecordOf<_TlfSyncPartial>

export type TlfSyncConfig = TlfSyncEnabled | TlfSyncDisabled | TlfSyncPartial

export enum ConflictState {
  None = 'none',
  InConflictStuck = 'in-conflict-stuck',
  InConflictNotStuck = 'in-conflict-not-stuck',
  InManualResolution = 'in-manual-resolution',
  Finishing = 'finishing',
}

export type _TlfConflict = {
  state: ConflictState
  branch: string
}
export type TlfConflict = I.RecordOf<_TlfConflict>

export type _Tlf = {
  conflict: TlfConflict
  isFavorite: boolean
  isIgnored: boolean
  isNew: boolean
  name: string
  resetParticipants: I.List<string> // usernames
  // TODO: when we move this stuff into SimpleFS, this should no longer need
  //  to be nullable
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
}
export type Tlf = I.RecordOf<_Tlf>

// name -> Tlf
export type TlfList = I.Map<string, Tlf>

export type _Tlfs = {
  private: TlfList
  public: TlfList
  team: TlfList
}
export type Tlfs = I.RecordOf<_Tlfs>

export enum PathKind {
  Root = 'root',
  TlfList = 'tlf-list',
  GroupTlf = 'group-tlf',
  TeamTlf = 'team-tlf',
  InGroupTlf = 'in-group-tlf',
  InTeamTlf = 'in-team-tlf',
}

export type _ParsedPathRoot = {
  kind: PathKind.Root
}
export type ParsedPathRoot = I.RecordOf<_ParsedPathRoot>

export type _ParsedPathTlfList = {
  kind: PathKind.TlfList
  tlfType: TlfType
}
export type ParsedPathTlfList = I.RecordOf<_ParsedPathTlfList>

export type _ParsedPathGroupTlf = {
  kind: PathKind.GroupTlf
  tlfName: string
  tlfType: TlfType.Private | TlfType.Public
  writers: I.List<string>
  readers: I.List<string> | null
}
export type ParsedPathGroupTlf = I.RecordOf<_ParsedPathGroupTlf>

export type _ParsedPathTeamTlf = {
  kind: PathKind.TeamTlf
  tlfName: string
  tlfType: TlfType.Team
  team: string
}
export type ParsedPathTeamTlf = I.RecordOf<_ParsedPathTeamTlf>

export type _ParsedPathInGroupTlf = {
  kind: PathKind.InGroupTlf
  tlfName: string
  tlfType: TlfType.Private | TlfType.Public
  writers: I.List<string>
  readers: I.List<string> | null
  rest: I.List<string>
}
export type ParsedPathInGroupTlf = I.RecordOf<_ParsedPathInGroupTlf>

export type _ParsedPathInTeamTlf = {
  kind: PathKind.InTeamTlf
  tlfName: string
  tlfType: TlfType.Team
  team: string
  rest: I.List<string>
}
export type ParsedPathInTeamTlf = I.RecordOf<_ParsedPathInTeamTlf>

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

export type _PrefetchNotStarted = {
  state: PrefetchState.NotStarted
}
export type PrefetchNotStarted = I.RecordOf<_PrefetchNotStarted>

export type _PrefetchInProgress = {
  state: PrefetchState.InProgress
  startTime: number
  endEstimate: number
  bytesTotal: number
  bytesFetched: number
}
export type PrefetchInProgress = I.RecordOf<_PrefetchInProgress>

export type _PrefetchComplete = {
  state: PrefetchState.Complete
}
export type PrefetchComplete = I.RecordOf<_PrefetchComplete>

export type PrefetchStatus = PrefetchNotStarted | PrefetchInProgress | PrefetchComplete

type _PathItemMetadata = {
  name: string
  lastModifiedTimestamp: number
  size: number
  lastWriter: string
  writable: boolean
  prefetchStatus: PrefetchStatus
}

export type _FolderPathItem = {
  type: PathType.Folder
  children: I.Set<string>
  progress: ProgressType
} & _PathItemMetadata
export type FolderPathItem = I.RecordOf<_FolderPathItem>

export type _SymlinkPathItem = {
  type: PathType.Symlink
  linkTarget: string
} & _PathItemMetadata
export type SymlinkPathItem = I.RecordOf<_SymlinkPathItem>

export type _Mime = {
  mimeType: string
  displayPreview: boolean
}
export type Mime = I.RecordOf<_Mime>

export type _FilePathItem = {
  type: PathType.File
  mimeType: Mime | null
} & _PathItemMetadata
export type FilePathItem = I.RecordOf<_FilePathItem>

export type _UnknownPathItem = {
  type: PathType.Unknown
} & _PathItemMetadata
export type UnknownPathItem = I.RecordOf<_UnknownPathItem>

export type PathItem = FolderPathItem | SymlinkPathItem | FilePathItem | UnknownPathItem

export enum SyncStatusStatic {
  Unknown = 'unknown', // trying to figure out what it is
  AwaitingToSync = 'awaiting-to-sync', // sync enabled but we're offline
  AwaitingToUpload = 'awaiting-to-upload', // has local changes but we're offline
  OnlineOnly = 'online-only', // sync disabled
  Synced = 'synced', // sync enabled and fully synced
  SyncError = 'sync-error', // uh oh
  Uploading = 'uploading', // flushing or writing into journal and we're online
}
export type SyncStatus = SyncStatusStatic | number // percentage<1. not uploading, and we're syncing down

export type EditID = string
export enum EditType {
  NewFolder = 'new-folder',
}
export enum EditStatusType {
  Editing = 'editing',
  Saving = 'saving',
  Failed = 'failed',
}

export type _NewFolder = {
  type: EditType.NewFolder
  parentPath: Path
  name: string
  hint: string
  status: EditStatusType
}
export type NewFolder = I.RecordOf<_NewFolder>

export type Edit = NewFolder

export enum SortSetting {
  NameAsc = 'name-asc',
  NameDesc = 'name-desc',
  TimeAsc = 'time-asc',
  TimeDesc = 'time-desc',
}

export type _PathUserSetting = {
  sort: SortSetting
}
export type PathUserSetting = I.RecordOf<_PathUserSetting>

export type LocalPath = string

export enum DownloadIntent {
  None = 'none',
  CameraRoll = 'camera-roll',
  Share = 'share',
}

export type _DownloadMeta = {
  entryType: PathType
  intent: DownloadIntent
  path: Path
  localPath: LocalPath
  opID: RPCTypes.OpID
}
export type DownloadMeta = I.RecordOf<_DownloadMeta>

export type _DownloadState = {
  canceled: boolean
  completePortion: number
  endEstimate?: number
  error?: FsError
  isDone: boolean
  startedAt: number
}
export type DownloadState = I.RecordOf<_DownloadState>

export type _Download = {
  meta: DownloadMeta
  state: DownloadState
}
export type Download = I.RecordOf<_Download>

export type Downloads = I.Map<string, Download>

export type _Uploads = {
  writingToJournal: I.Set<Path>
  errors: I.Map<Path, FsError>
  totalSyncingBytes: number
  endEstimate?: number
  syncingPaths: I.Set<Path>
}
export type Uploads = I.RecordOf<_Uploads>

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

export type _LocalHTTPServer = {
  address: string
  token: string
}
export type LocalHTTPServer = I.RecordOf<_LocalHTTPServer>

export enum FileEditType {
  Created = 'created',
  Modified = 'modified',
  Deleted = 'deleted',
  Renamed = 'renamed',
  Unknown = 'unknown',
}

export type _TlfEdit = {
  filename: string
  serverTime: number
  editType: FileEditType
}

export type TlfEdit = I.RecordOf<_TlfEdit>

export type _TlfUpdate = {
  path: Path
  writer: string
  serverTime: number
  history: I.List<TlfEdit>
}

export type TlfUpdate = I.RecordOf<_TlfUpdate>

export type UserTlfUpdates = I.List<TlfUpdate>

export type PathItems = I.Map<Path, PathItem>

export type Edits = I.Map<EditID, Edit>

export enum DestinationPickerSource {
  None = 'none',
  MoveOrCopy = 'move-or-copy',
  IncomingShare = 'incoming-share',
}

export type _MoveOrCopySource = {
  type: DestinationPickerSource.MoveOrCopy
  path: Path
}
export type MoveOrCopySource = I.RecordOf<_MoveOrCopySource>

export type _IncomingShareSource = {
  type: DestinationPickerSource.IncomingShare
  localPath: LocalPath
}

export type IncomingShareSource = I.RecordOf<_IncomingShareSource>

export type _NoSource = {
  type: DestinationPickerSource.None
}

export type NoSource = I.RecordOf<_NoSource>

export type _DestinationPicker = {
  // id -> Path mapping. This is useful for mobile when we have multiple layers
  // stacked on top of each other, and we need to keep track of them for the
  // back button. We don't put this in routeProps directly as that'd
  // complicate stuff for desktop because we don't have something like a
  // routeToSibling.
  destinationParentPath: I.List<Path>
  source: MoveOrCopySource | IncomingShareSource | NoSource
}

export type DestinationPicker = I.RecordOf<_DestinationPicker>

export enum SendAttachmentToChatState {
  None = 'none',
  PendingSelectConversation = 'pending-select-conversation',
  ReadyToSend = 'ready-to-send', // a conversation is selected
  Sent = 'sent',
}

export type _SendAttachmentToChat = {
  filter: string
  path: Path
  convID: ChatTypes.ConversationIDKey
  state: SendAttachmentToChatState
}
export type SendAttachmentToChat = I.RecordOf<_SendAttachmentToChat>

export enum SendLinkToChatState {
  None = 'none',
  // when the modal is just shown and we don't know the convID(s) yet
  LocatingConversation = 'locating-conversation',
  // only applicable to big teams with multiple channels
  PendingSelectConversation = 'pending-select-conversation',
  // possibly without a convID, in which case we'll create it
  ReadyToSend = 'ready-to-send',
  Sending = 'sending',
  Sent = 'sent',
}

export type _SendLinkToChat = {
  // populated for teams only
  channels: I.Map<ChatTypes.ConversationIDKey, string>
  // This is the convID that we are sending into. So for group chats or small
  // teams, this is the conversation. For big teams, this is the selected
  // channel.
  convID: ChatTypes.ConversationIDKey
  path: Path
  state: SendLinkToChatState
}
export type SendLinkToChat = I.RecordOf<_SendLinkToChat>

export enum PathItemActionMenuView {
  Root = 'root',
  Share = 'share',
  ConfirmSaveMedia = 'confirm-save-media',
  ConfirmSendToOtherApp = 'confirm-send-to-other-app',
}
export type _PathItemActionMenu = {
  view: PathItemActionMenuView
  previousView: PathItemActionMenuView
  downloadKey: string | null
}
export type PathItemActionMenu = I.RecordOf<_PathItemActionMenu>

export enum DriverStatusType {
  Unknown = 'unknown',
  Disabled = 'disabled',
  Enabled = 'enabled',
}
export type _DriverStatusUnknown = {
  type: DriverStatusType.Unknown
}
export type DriverStatusUnknown = I.RecordOf<_DriverStatusUnknown>

export type _DriverStatusDisabled = {
  type: DriverStatusType.Disabled
  isEnabling: boolean
  isDismissed: boolean
  // macOS only
  kextPermissionError: boolean
}
export type DriverStatusDisabled = I.RecordOf<_DriverStatusDisabled>

export type _DriverStatusEnabled = {
  type: DriverStatusType.Enabled
  isDisabling: boolean
  isNew: boolean
  // windows only
  dokanOutdated: boolean
  dokanUninstallExecPath?: string | null
}
export type DriverStatusEnabled = I.RecordOf<_DriverStatusEnabled>

export type DriverStatus = DriverStatusUnknown | DriverStatusDisabled | DriverStatusEnabled

export type _SystemFileManagerIntegration = {
  driverStatus: DriverStatus
  // This only controls if system-file-manager-integration-banner is shown in
  // Folders view. The banner always shows in Settings/Files screen.
  showingBanner: boolean
}
export type SystemFileManagerIntegration = I.RecordOf<_SystemFileManagerIntegration>

export enum KbfsDaemonRpcStatus {
  Unknown = 'unknown',
  Connected = 'connected',
  Waiting = 'waiting',
  WaitTimeout = 'wait-timeout',
}
export type _KbfsDaemonStatus = {
  rpcStatus: KbfsDaemonRpcStatus
  online: boolean
}
export type KbfsDaemonStatus = I.RecordOf<_KbfsDaemonStatus>

export type _SyncingFoldersProgress = {
  bytesFetched: number
  bytesTotal: number
  endEstimate: number
  start: number
}
export type SyncingFoldersProgress = I.RecordOf<_SyncingFoldersProgress>

export enum DiskSpaceStatus {
  Ok = 'ok',
  Warning = 'warning',
  Error = 'error',
}
export type _OverallSyncStatus = {
  syncingFoldersProgress: SyncingFoldersProgress
  diskSpaceStatus: DiskSpaceStatus
  diskSpaceBannerHidden: boolean
}
export type OverallSyncStatus = I.RecordOf<_OverallSyncStatus>

export enum SoftError {
  NoAccess = 'no-access',
  Nonexistent = 'non-existent',
}

export type _SoftErrors = {
  pathErrors: I.Map<Path, SoftError>
  tlfErrors: I.Map<Path, SoftError>
}
export type SoftErrors = I.RecordOf<_SoftErrors>

export type _Settings = {
  spaceAvailableNotificationThreshold: number
  isLoading: boolean
}

export type Settings = I.RecordOf<_Settings>

export type _State = {
  destinationPicker: DestinationPicker
  downloads: Downloads
  edits: Edits
  errors: I.Map<string, FsError>
  folderViewFilter: string
  kbfsDaemonStatus: KbfsDaemonStatus
  lastPublicBannerClosedTlf: string
  loadingPaths: I.Map<Path, I.Set<string>>
  localHTTPServerInfo: LocalHTTPServer
  overallSyncStatus: OverallSyncStatus
  pathItemActionMenu: PathItemActionMenu
  pathItems: PathItems
  pathUserSettings: I.Map<Path, PathUserSetting>
  sendAttachmentToChat: SendAttachmentToChat
  sendLinkToChat: SendLinkToChat
  settings: Settings
  sfmi: SystemFileManagerIntegration
  softErrors: SoftErrors
  tlfUpdates: UserTlfUpdates
  tlfs: Tlfs
  uploads: Uploads
}
export type State = I.RecordOf<_State>

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
export const getPathName = (p: Path): string => (!p ? '' : p.split('/').pop())
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
    if (elem !== '') {
      return elem
    }
  }
  return ''
}
export const getLocalPathDir = (p: LocalPath): string => p.slice(0, p.lastIndexOf(localSep))
export const getNormalizedLocalPath = (p: LocalPath): LocalPath =>
  localSep === '\\' ? p.replace(/\\/g, '/') : p

export enum PathItemIconType {
  TeamAvatar = 'team-avatar',
  Avatar = 'avatar',
  Avatars = 'avatars',
  Basic = 'basic',
}

export type PathItemIconSpec =
  | {
      type: PathItemIconType.TeamAvatar
      teamName: string
    }
  | {
      type: PathItemIconType.Avatar
      username: string
    }
  | {
      type: PathItemIconType.Avatars
      usernames: Array<string>
    }
  | {
      type: PathItemIconType.Basic
      iconType: IconType
      iconColor: string
    }

export type ItemStyles = {
  iconSpec: PathItemIconSpec
  textColor: string
  textType: TextType
}

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
  name: string
  private: boolean
  folderType: RPCTypes.FolderType
  problem_set?: {
    solution_kids: {[K in string]: Array<string>}
    can_self_help: boolean
  }
  team_id: string | null
  reset_members: Array<ResetMember> | null
}

export enum FileViewType {
  Text = 'text',
  Image = 'image',
  Av = 'av',
  Pdf = 'pdf',
  Default = 'default',
}

export type ResetMetadata = {
  badgeIDKey: TeamsTypes.ResetUserBadgeIDKey
  name: string
  visibility: Visibility
  resetParticipants: Array<string>
}

// RefreshTag is used by components in FsGen.folderListLoad and
// FsGen.mimeTypeLoad actions, to indicate that it's interested in refreshing
// such data if some FS activity notification indicates it may have changed.
// Note that this is not a subscrition based model where a component needs to
// unsubscribe when it's not interested anymore. Instead, we use a simple
// heuristic where Saga only keeps track of latest call from each component and
// refresh only the most recently reuested paths for each component.
export enum RefreshTag {
  Main = 'main',
  PathItemActionPopup = 'path-item-action-popup',
  DestinationPicker = 'destination-picker',
}

export enum PathItemBadgeType {
  Upload = 'upload',
  Download = 'download',
  New = 'new',
  Rekey = 'rekey',
}
export type PathItemBadge = PathItemBadgeType | number

export enum ResetBannerNoOthersType {
  None = 'none',
  Self = 'self',
}
export type ResetBannerType = ResetBannerNoOthersType | number
export enum MainBannerType {
  None = 'none',
  Offline = 'offline',
  OutOfSpace = 'out-of-space',
}
