// @flow
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import * as Devices from './devices'
import * as TeamsTypes from '../../constants/types/teams'
import type {IconType} from '../../common-adapters'
import {type TextType} from '../../common-adapters/text'
import {isWindows} from '../platform'

export opaque type Path = ?string

export type PathType = 'folder' | 'file' | 'symlink' | 'unknown'
export type ProgressType = 'favorite' | 'pending' | 'loaded'

export type Device = {
  type: Devices.DeviceType,
  name: string,
  deviceID: string,
}

export type ParticipantUnlock = {
  name: string,
  devices: string,
}

export type ResetMember = {
  username: string,
  uid: string,
}

export type FavoriteMetadata = {|
  folderType: RPCTypes.FolderType,
  isIgnored: boolean,
  isNew: boolean,
  needsRekey: boolean,
  waitingForParticipantUnlock?: Array<ParticipantUnlock>,
  youCanUnlock?: Array<Device>,
  resetParticipants: Array<ResetMember>,
  teamId: RPCTypes.TeamID,
|}

export type _FavoriteItem = {
  badgeCount: number,
  name: string,
  tlfMeta?: FavoriteMetadata,
  favoriteChildren?: I.Set<string>,
}

export type FavoriteItem = I.RecordOf<_FavoriteItem>

export type PathItemMetadata = {
  name: string,
  lastModifiedTimestamp: number,
  size: number,
  lastWriter: RPCTypes.User,
  progress: ProgressType,
  badgeCount: number,
  tlfMeta?: FavoriteMetadata,
}

export type _FolderPathItem = {
  type: 'folder',
  children: I.Set<string>,
  favoriteChildren: I.Set<string>,
} & PathItemMetadata
export type FolderPathItem = I.RecordOf<_FolderPathItem>

export type _SymlinkPathItem = {
  type: 'symlink',
  linkTarget: string,
} & PathItemMetadata
export type SymlinkPathItem = I.RecordOf<_SymlinkPathItem>

export type _FilePathItem = {
  type: 'file',
  mimeType: string,
} & PathItemMetadata
export type FilePathItem = I.RecordOf<_FilePathItem>

export type _UnknownPathItem = {
  type: 'unknown',
} & PathItemMetadata
export type UnknownPathItem = I.RecordOf<_UnknownPathItem>

export type PathItem = FolderPathItem | SymlinkPathItem | FilePathItem | UnknownPathItem

export opaque type EditID = string
export type EditType = 'new-folder'
export type EditStatusType = 'editing' | 'saving' | 'failed'

export type _NewFolder = {
  type: 'new-folder',
  parentPath: Path,
  name: string,
  hint: string,
  status: EditStatusType,
}
export type NewFolder = I.RecordOf<_NewFolder>

export type Edit = NewFolder

export type SortBy = 'name' | 'time'
export type SortOrder = 'asc' | 'desc'
export type _SortSetting = {
  sortBy: SortBy,
  sortOrder: SortOrder,
}
export type SortSetting = I.RecordOf<_SortSetting>

export type _PathUserSetting = {
  sort: SortSetting,
}
export type PathUserSetting = I.RecordOf<_PathUserSetting>

export type LocalPath = string

export type DownloadIntentMobile = 'camera-roll' | 'share'
export type DownloadIntentWebview = 'web-view-text' | 'web-view'
export type DownloadIntent = 'none' | DownloadIntentMobile | DownloadIntentWebview

export type _DownloadMeta = {
  entryType: PathType,
  intent: DownloadIntent,
  path: Path,
  localPath: LocalPath,
  opID: RPCTypes.OpID,
}
export type DownloadMeta = I.RecordOf<_DownloadMeta>

export type _DownloadState = {
  completePortion: number,
  endEstimate?: number,
  error?: string,
  isDone: boolean,
  startedAt: number,
}
export type DownloadState = I.RecordOf<_DownloadState>

export type _Download = {
  meta: DownloadMeta,
  state: DownloadState,
}
export type Download = I.RecordOf<_Download>

export type _Upload = {
  writingToJournal: boolean,
  journalFlushing: boolean,
  error?: string,
}
export type Upload = I.RecordOf<_Upload>

// 'both' is only supported on macOS
export type OpenDialogType = 'file' | 'directory' | 'both'

export type PathBreadcrumbItem = {
  isTlfNameItem: boolean,
  isLastItem: boolean,
  name: string,
  path: Path,
  onOpenBreadcrumb: (evt?: SyntheticEvent<>) => void,
}

export type _Flags = {
  kbfsOpening: boolean,
  kbfsInstalling: boolean,
  fuseInstalling: boolean,
  kextPermissionError: boolean,
  securityPrefsPropmted: boolean,
  showBanner: boolean,
  syncing: boolean,
}

export type Flags = I.RecordOf<_Flags>

export type _LocalHTTPServer = {
  address: string,
  token: string,
}
export type LocalHTTPServer = I.RecordOf<_LocalHTTPServer>

export type _State = {
  pathItems: I.Map<Path, PathItem>,
  edits: I.Map<EditID, Edit>,
  pathUserSettings: I.Map<Path, PathUserSetting>,
  loadingPaths: I.Set<Path>,
  downloads: I.Map<string, Download>,
  uploads: I.Map<Path, I.Map<string, Upload>>, // parent path -> name -> Upload
  fuseStatus: ?RPCTypes.FuseStatus,
  flags: Flags,
  localHTTPServerInfo: ?LocalHTTPServer,
}
export type State = I.RecordOf<_State>

export type Visibility = 'private' | 'public' | 'team' | null

export const direntToPathType = (d: RPCTypes.Dirent): PathType => {
  switch (d.direntType) {
    case RPCTypes.simpleFSDirentType.dir:
      return 'folder'
    case RPCTypes.simpleFSDirentType.sym:
      return 'symlink'
    case RPCTypes.simpleFSDirentType.file:
    case RPCTypes.simpleFSDirentType.exec:
      return 'file'
    default:
      return 'unknown'
  }
}

export const stringToEditID = (s: string): EditID => s
export const editIDToString = (s: EditID): string => s
export const stringToPath = (s: string): Path => (s.indexOf('/') === 0 ? s : null)
export const pathToString = (p: Path): string => (!p ? '' : p)
// export const stringToLocalPath = (s: string): LocalPath => s
// export const localPathToString = (p: LocalPath): string => p
export const getPathName = (p: Path): string => (!p ? '' : p.split('/').pop())
export const getPathNameFromElems = (elems: Array<string>): string => {
  if (elems.length === 0) return ''
  return elems.pop()
}
export const getPathLevel = (p: Path): number => (!p ? 0 : getPathElements(p).length)
export const getPathParent = (p: Path): Path =>
  !p
    ? ''
    : p
        .split('/')
        .slice(0, -1)
        .join('/')
export const getPathElements = (p: Path): Array<string> => (!p ? [] : p.split('/').slice(1))
export const getVisibilityFromElems = (elems: Array<string>) => {
  if (elems.length < 2 || !elems[1]) return null
  const visibility = elems[1]
  switch (visibility) {
    case 'private':
    case 'public':
    case 'team':
      return visibility
    default:
      // We don't do a flow check here because by now flow knows that we can't
      // be an empty string, so asserting empty will always fail.
      return null
  }
}
export const getRPCFolderTypeFromVisibility = (v: Visibility): RPCTypes.FolderType => {
  if (v === null) return RPCTypes.favoriteFolderType.unknown
  return RPCTypes.favoriteFolderType[v]
}
export const getPathVisibility = (p: Path): Visibility => {
  const elems = getPathElements(p)
  return getVisibilityFromElems(elems)
}
export const stringToPathType = (s: string): PathType => {
  switch (s) {
    case 'folder':
    case 'file':
    case 'symlink':
    case 'unknown':
      return s
    default:
      // We don't do a flow check here because by now flow knows that we can't
      // be an empty string, so asserting empty will always fail.
      throw new Error('Invalid path type')
  }
}
export const pathTypeToString = (p: PathType): string => p
export const pathConcat = (p: Path, s: string): Path =>
  p === '/' ? stringToPath('/' + s) : stringToPath(pathToString(p) + '/' + s)
export const pathIsNonTeamTLFList = (p: Path): boolean => {
  const str = pathToString(p)
  return str === '/keybase/private' || str === '/keybase/public'
}
export const getPathDir = (p: Path): Path => pathToString(p).slice(0, pathToString(p).lastIndexOf('/'))

const localSep = isWindows ? '\\' : '/'

export const localPathConcat = (p: LocalPath, s: string): LocalPath => p + localSep + s
export const getLocalPathName = (localPath: LocalPath): string => {
  const elems = localPath.split('/')
  for (let elem = elems.pop(); elems.length; elem = elems.pop()) {
    if (elem !== '') {
      return elem
    }
  }
  return ''
}
export const getLocalPathDir = (p: LocalPath): string => p.slice(0, p.lastIndexOf(localSep))

type sortSettingDisplayParams = {
  sortSettingText: string,
  sortSettingIconType: IconType,
}

export const sortSettingToIconTypeAndText = (s: _SortSetting): sortSettingDisplayParams => {
  switch (s.sortBy) {
    case 'name':
      return s.sortOrder === 'asc'
        ? {
            sortSettingIconType: 'iconfont-arrow-full-down',
            sortSettingText: 'Name ascending',
          }
        : {
            sortSettingIconType: 'iconfont-arrow-full-up',
            sortSettingText: 'Name descending',
          }
    case 'time':
      return s.sortOrder === 'asc'
        ? {
            sortSettingIconType: 'iconfont-time',
            sortSettingText: 'Recent first',
          }
        : {
            sortSettingIconType: 'iconfont-time-reversed',
            sortSettingText: 'Older first',
          }
    default:
      throw new Error('invalid SortBy')
  }
}

export type PathItemIconSpec =
  | {
      type: 'teamAvatar',
      teamName: string,
    }
  | {
      type: 'avatar',
      username: string,
    }
  | {
      type: 'avatars',
      usernames: Array<string>,
    }
  | {
      type: 'basic',
      iconType: IconType,
      iconColor: string,
    }

export type ItemStyles = {
  iconSpec: PathItemIconSpec,
  textColor: string,
  textType: TextType,
}

export type FolderRPCWithMeta = {
  name: string,
  folderType: RPCTypes.FolderType,
  isIgnored: boolean,
  isNew: boolean,
  needsRekey: boolean,
  waitingForParticipantUnlock?: Array<ParticipantUnlock>,
  youCanUnlock?: Array<Device>,
  team_id: ?string,
  reset_members: ?Array<ResetMember>,
}

export type FavoriteFolder = {
  name: string,
  private: boolean,
  folderType: RPCTypes.FolderType,
  problem_set?: {
    // Map of UID to a list of KIDs, for this folder
    solution_kids: {[string]: Array<string>},
    can_self_help: boolean,
  },
  team_id: ?string,
  reset_members: ?Array<ResetMember>,
}

export type FileViewType = 'text' | 'image' | 'av' | 'pdf' | 'default'

export type ResetMetadata = {
  badgeIDKey: TeamsTypes.ResetUserBadgeIDKey,
  name: string,
  visibility: Visibility,
  resetParticipants: Array<string>,
}

export type StillRowItem = {
  rowType: 'still',
  path: Path,
  name: string,
}

export type EditingRowItem = {
  rowType: 'editing',
  editID: EditID,
  name: string,
}

export type UploadingRowItem = {
  rowType: 'uploading',
  name: string,
  path: Path,
}

export type PlaceholderRowItem = {
  rowType: 'placeholder',
  name: string,
}

export type RowItem = StillRowItem | EditingRowItem | UploadingRowItem | PlaceholderRowItem
