// @flow
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import * as Devices from './devices'
import {type IconType} from '../../common-adapters/icon'
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

export type FavoriteMetadata = {
  folderType: RPCTypes.FolderType,
  isIgnored: boolean,
  isNew: boolean,
  needsRekey: boolean,
  waitingForParticipantUnlock?: Array<ParticipantUnlock>,
  youCanUnlock?: Array<Device>,
}

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
  lastWriter: RPCTypes.User,
  size: number,
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
  linkTarget: Path,
} & PathItemMetadata
export type SymlinkPathItem = I.RecordOf<_SymlinkPathItem>

export type _FilePathItem = {
  type: 'file',
} & PathItemMetadata
export type FilePathItem = I.RecordOf<_FilePathItem>

export type _UnknownPathItem = {
  type: 'unknown',
} & PathItemMetadata
export type UnknownPathItem = I.RecordOf<_UnknownPathItem>

export type PathItem = FolderPathItem | SymlinkPathItem | FilePathItem | UnknownPathItem

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

export type TransferType = 'upload' | 'download'
export type TransferIntent = 'none' | 'camera-roll' | 'share'

export type _TransferMeta = {
  type: TransferType,
  entryType: PathType,
  intent: TransferIntent,
  path: Path,
  localPath: LocalPath,
  opID: RPCTypes.OpID,
}
export type TransferMeta = I.RecordOf<_TransferMeta>

export type _TransferState = {
  completePortion: number,
  endEstimate?: number,
  error?: string,
  isDone: boolean,
  startedAt: number,
}
export type TransferState = I.RecordOf<_TransferState>

export type _Transfer = {
  meta: TransferMeta,
  state: TransferState,
}
export type Transfer = I.RecordOf<_Transfer>

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

export type _State = {
  pathItems: I.Map<Path, PathItem>,
  pathUserSettings: I.Map<Path, PathUserSetting>,
  loadingPaths: I.Set<Path>,
  transfers: I.Map<string, Transfer>,
  fuseStatus: ?RPCTypes.FuseStatus,
  flags: Flags,
}
export type State = I.RecordOf<_State>

export type Visibility = 'private' | 'public' | 'team' | null

export const stringToPath = (s: string): Path => (s.indexOf('/') === 0 ? s : null)
export const pathToString = (p: Path): string => (!p ? '' : p)
// export const stringToLocalPath = (s: string): LocalPath => s
// export const localPathToString = (p: LocalPath): string => p
export const getPathName = (p: Path): string => (!p ? '' : p.split('/').pop())
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
export const getLocalPathName = (p: LocalPath): string => p.split(localSep).pop()
export const getLocalPathDir = (p: LocalPath): string => p.slice(0, p.lastIndexOf(localSep))

type PathItemComparer = (a: PathItem, b: PathItem) => number
type PathItemLessThan = (a: PathItem, b: PathItem) => boolean

const _comparerFromLessThan = (lt: PathItemLessThan): PathItemComparer => (a, b) =>
  lt(a, b) ? -1 : lt(b, a) ? 1 : 0

const _neutralComparer = (a: PathItem, b: PathItem): number => 0

const _getMeFirstComparer = (meUsername: string): PathItemComparer =>
  _comparerFromLessThan((a: PathItem, b: PathItem): boolean => a.name === meUsername && b.name !== meUsername)

const _folderFirstComparer: PathItemComparer = _comparerFromLessThan(
  (a: PathItem, b: PathItem): boolean =>
    a.type === 'folder'
      ? b.type !== 'folder' || (!!a.tlfMeta && a.tlfMeta.isNew && !(b.tlfMeta && b.tlfMeta.isNew))
      : false
)

export const _getSortByComparer = (sortBy: SortBy): PathItemComparer => {
  switch (sortBy) {
    case 'name':
      return (a: PathItem, b: PathItem): number => a.name.localeCompare(b.name)
    case 'time':
      return (a: PathItem, b: PathItem): number =>
        b.lastModifiedTimestamp - a.lastModifiedTimestamp || a.name.localeCompare(b.name)
    default:
      throw new Error('invalid SortBy: ' + sortBy)
  }
}

export const sortSettingToCompareFunction = (
  {sortBy, sortOrder}: SortSetting,
  meUsername?: string
): PathItemComparer => {
  const meFirstComparer = meUsername ? _getMeFirstComparer(meUsername) : _neutralComparer
  const sortByComparer = _getSortByComparer(sortBy)
  const multiplier = sortOrder === 'desc' ? -1 : 1
  return (a: PathItem, b: PathItem): number =>
    multiplier * (meFirstComparer(a, b) || _folderFirstComparer(a, b) || sortByComparer(a, b))
}
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
}
