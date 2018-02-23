// @flow
import * as I from 'immutable'
import {type IconType} from '../../common-adapters/icon'

export opaque type Path = ?string

export type PathType = 'folder' | 'file' | 'symlink' | 'unknown'
export type ProgressType = 'pending' | 'loaded'

export type PathItemMetadata = {
  name: string,
  lastModifiedTimestamp: number,
  size: number,
  lastWriter?: string,
  progress: ProgressType,
}

export type _FolderPathItem = {
  type: 'folder',
  children: I.List<string>,
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

export type PathBreadcrumbItem = {
  isTlfNameItem: boolean,
  isLastItem: boolean,
  name: string,
  onOpenBreadcrumb: (evt?: SyntheticEvent<>) => void,
}

export type _State = {
  pathItems: I.Map<Path, PathItem>,
  pathUserSettings: I.Map<Path, PathUserSetting>,
}
export type State = I.RecordOf<_State>

export type Visibility = 'private' | 'public' | 'team' | null

export const stringToPath = (s: string): Path => (s.indexOf('/') === 0 ? s : null)
export const pathToString = (p: Path): string => (!p ? '' : p)
export const getPathName = (p: Path): string => (!p ? '' : p.split('/').pop())
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

type PathItemComparer = (a: PathItem, b: PathItem) => number

const _neutralComparer = (a: PathItem, b: PathItem): number => 0

const _getMeFirstComparer = (meUsername: string): PathItemComparer => (a: PathItem, b: PathItem): number =>
  a.name === meUsername ? -1 : b.name === meUsername ? 1 : 0

const _folderFirstComparer: PathItemComparer = (a: PathItem, b: PathItem): number => {
  if (a.type === 'folder' && b.type !== 'folder') {
    return -1
  } else if (a.type !== 'folder' && b.type === 'folder') {
    return 1
  }
  return 0
}

export const _getSortByComparer = (sortBy: SortBy): PathItemComparer => {
  switch (sortBy) {
    case 'name':
      return (a: PathItem, b: PathItem): number => a.name.localeCompare(b.name)
    case 'time':
      return (a: PathItem, b: PathItem): number =>
        a.lastModifiedTimestamp - b.lastModifiedTimestamp || a.name.localeCompare(b.name)
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
            sortSettingIconType: 'iconfont-new',
            sortSettingText: 'Name ascending',
          }
        : {
            sortSettingIconType: 'iconfont-new',
            sortSettingText: 'Name descending',
          }
    case 'time':
      return s.sortOrder === 'asc'
        ? {
            sortSettingIconType: 'iconfont-new',
            sortSettingText: 'Recent first',
          }
        : {
            sortSettingIconType: 'iconfont-new',
            sortSettingText: 'Older first',
          }
    default:
      throw new Error('invalid SortBy')
  }
}
