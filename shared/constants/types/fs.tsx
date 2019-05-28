import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import * as ChatTypes from './chat2'
import * as Devices from './devices'
import * as TeamsTypes from '../../constants/types/teams'
// TODO importing FsGen causes an import loop
import * as FsGen from '../../actions/fs-gen'
import {IconType} from '../../common-adapters/icon.constants'
// @ts-ignore TODO: remove this ignore when common-adapters are TSed
import {TextType} from '../../common-adapters/text'
import {isWindows} from '../platform'
import {memoize} from '../../util/memoize'
// lets not create cycles in flow, lets discuss how to fix this
// import {type Actions} from '../../actions/fs-gen'

export type Path = string | null

export const enum PathType {
  Folder,
  File,
  Symlink,
  Unknown,
}
export const enum ProgressType {
  Pending,
  Loaded,
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

export const enum TlfType {
  Public,
  Private,
  Team,
}

export const enum TlfSyncMode {
  Enabled,
  Disabled,
  Partial,
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

export const enum ConflictState {
  InConflictStuck,
  InCondlictNotStuck,
  InManualResolution,
  Finishing,
  None,
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
  resetParticipants: I.List<string>
  syncConfig: TlfSyncConfig | null
  teamId: RPCTypes.TeamID
  tlfMtime: number
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

export const enum PathKind {
  Root,
  TlfList,
  GroupTlf,
  TeamTlf,
  InGroupTlf,
  InTeamTlf,
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

export const enum PrefetchState {
  NotStarted,
  InProgress,
  Complete,
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

export const enum SyncStatusStatic {
  Unknown,
  AwaitingToSync,
  AwaitingToUpload,
  OnlineOnly,
  Synced,
  SyncError,
  Uploading,
}
export type SyncStatus = SyncStatusStatic | number // percentage<1. not uploading, and we're syncing down

export type EditID = string
export const enum EditType {
  NewFolder,
}
export const enum EditStatusType {
  Editing,
  Saving,
  Failed,
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

export const enum SortSetting {
  NameAsc,
  NameDesc,
  TimeAsc,
  TimeDesc,
}

export type _PathUserSetting = {
  sort: SortSetting
}
export type PathUserSetting = I.RecordOf<_PathUserSetting>

export type LocalPath = string

export const enum DownloadIntentMobile {
  CameraRoll,
  Share,
}
// TODO: what to do here

const enum DownloadIntentEnum {
  None,
}
export const DownloadIntentNone = DownloadIntentEnum.None
export type DownloadIntent = DownloadIntentEnum | DownloadIntentMobile

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
export const enum OpenDialogType {
  File,
  Directory,
  Both,
}
export const enum MobilePickType {
  Photo,
  Video,
  Mixed,
}

export type _LocalHTTPServer = {
  address: string
  token: string
}
export type LocalHTTPServer = I.RecordOf<_LocalHTTPServer>

export const enum FileEditType {
  Created,
  Modified,
  Deleted,
  Renamed,
  Unknown,
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

export const enum DestinationPickerSource {
  MoveOrCopy,
  IncomingShare,
  None,
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
  destinationParentPath: I.List<Path>
  source: MoveOrCopySource | IncomingShareSource | NoSource
}

export type DestinationPicker = I.RecordOf<_DestinationPicker>

export const enum SendAttachmentToChatState {
  None,
  PendingSelectConversation,
  ReadyToSend,
  Sent,
}

export type _SendAttachmentToChat = {
  filter: string
  path: Path
  convID: ChatTypes.ConversationIDKey
  state: SendAttachmentToChatState
}
export type SendAttachmentToChat = I.RecordOf<_SendAttachmentToChat>

export const enum SendLinkToChatState {
  None,
  LocatingConversation,
  PendingSelectConversation,
  ReadyToSend,
  Sending,
  Sent,
}

export type _SendLinkToChat = {
  channels: I.Map<ChatTypes.ConversationIDKey, string>
  convID: ChatTypes.ConversationIDKey
  path: Path
  state: SendLinkToChatState
}
export type SendLinkToChat = I.RecordOf<_SendLinkToChat>

export const enum PathItemActionMenuView {
  Root,
  Share,
  ConfirmSaveMedia,
  ConfirmSendToOtherApp,
}
export type _PathItemActionMenu = {
  view: PathItemActionMenuView
  previousView: PathItemActionMenuView
  downloadKey: string | null
}
export type PathItemActionMenu = I.RecordOf<_PathItemActionMenu>

export const enum DriverStatusType {
  Unknown,
  Disabled,
  Enabled,
}
export type _DriverStatusUnknown = {
  type: DriverStatusType.Unknown
}
export type DriverStatusUnknown = I.RecordOf<_DriverStatusUnknown>

export type _DriverStatusDisabled = {
  type: DriverStatusType.Disabled
  isEnabling: boolean
  isDismissed: boolean
  kextPermissionError: boolean
}
export type DriverStatusDisabled = I.RecordOf<_DriverStatusDisabled>

export type _DriverStatusEnabled = {
  type: DriverStatusType.Enabled
  isDisabling: boolean
  isNew: boolean
  dokanOutdated: boolean
  dokanUninstallExecPath?: string | null
}
export type DriverStatusEnabled = I.RecordOf<_DriverStatusEnabled>

export type DriverStatus = DriverStatusUnknown | DriverStatusDisabled | DriverStatusEnabled

export type _SystemFileManagerIntegration = {
  driverStatus: DriverStatus
  showingBanner: boolean
}
export type SystemFileManagerIntegration = I.RecordOf<_SystemFileManagerIntegration>

export const enum KbfsDaemonRpcStatus {
  Unknown,
  Connected,
  Waiting,
  WaitTimeout,
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

export const enum SoftError {
  NoAccess,
  Nonexistent,
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
  downloads: Downloads
  edits: Edits
  errors: I.Map<string, FsError>
  folderViewFilter: string
  kbfsDaemonStatus: KbfsDaemonStatus
  loadingPaths: I.Map<Path, I.Set<string>>
  localHTTPServerInfo: LocalHTTPServer
  destinationPicker: DestinationPicker
  pathItemActionMenu: PathItemActionMenu
  pathItems: PathItems
  pathUserSettings: I.Map<Path, PathUserSetting>
  sendAttachmentToChat: SendAttachmentToChat
  sendLinkToChat: SendLinkToChat
  sfmi: SystemFileManagerIntegration
  softErrors: SoftErrors
  syncingFoldersProgress: SyncingFoldersProgress
  tlfUpdates: UserTlfUpdates
  tlfs: Tlfs
  uploads: Uploads
  settings: Settings
}
export type State = I.RecordOf<_State>

export type Visibility = TlfType | null

export const direntToPathType = (d: RPCTypes.Dirent): PathType => {
  switch (d.direntType) {
    case RPCTypes.simpleFSDirentType.dir:
      return PathType.Folder
    case RPCTypes.simpleFSDirentType.sym:
      return PathType.Symlink
    case RPCTypes.simpleFSDirentType.file:
    case RPCTypes.simpleFSDirentType.exec:
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
    case RPCTypes.favoriteFolderType.private:
      return TlfType.Private
    case RPCTypes.favoriteFolderType.public:
      return TlfType.Public
    case RPCTypes.favoriteFolderType.team:
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

export const enum PathItemIconType {
  TeamAvatar,
  Avatar,
  Avatars,
  Basic,
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

export const enum FileViewType {
  Text,
  Image,
  Av,
  Pdf,
  Default,
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
export const enum RefreshTag {
  Main,
  PathItemActionPopup,
  DestinationPicker,
}

export const enum PathItemBadgeType {
  Upload,
  Download,
  New,
  Rekey,
}
export type PathItemBadge = PathItemBadgeType | number

export const enum ResetBannerNoOthersType {
  None,
  Self,
}
export type ResetBannerType = ResetBannerNoOthersType | number
export const enum MainBannerType {
  Offline,
  OutOfSpace,
  None,
}
