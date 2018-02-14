// @flow
import * as I from 'immutable'

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

export type SortBy = 'name' | 'time' | 'size'
export type SortOrder = 'asc' | 'desc'
export type _SortSetting = {
  sortBy: SortBy,
  sortOrder: SortOrder,
  // TODO: what if we want /keybase/private/me to be first?
}
export type SortSetting = I.RecordOf<_SortSetting>

export type _PathUserSetting = {
  sort: SortSetting,
}
export type PathUserSetting = I.RecordOf<_PathUserSetting>

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
export const getPathVisibility = (p: Path): Visibility => {
  if (!p) return null
  const [, , visibility] = p.split('/')
  if (!visibility) return null
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
export const sortByToString = (s: SortBy): string => {
  switch (s) {
    case 'name':
      return 'Name'
    case 'time':
      return 'Last Modified Time'
    default:
      throw new Error('invalid SortBy')
  }
}
export const sortOrderToString = (s: SortOrder): string => {
  switch (s) {
    case 'asc':
      return '⬆'
    case 'desc':
      return '⬇'
    default:
      throw new Error('invalid SortOrder')
  }
}

type PathItemComparer = (a: PathItem, b: PathItem) => number

const _sortByToAscComparer = (s: SortBy): PathItemComparer => (a: PathItem, b: PathItem): number => {
  if (a.type === 'folder' && b.type !== 'folder') {
    return -1
  } else if (a.type !== 'folder' && b.type === 'folder') {
    return 1
  }

  switch (s) {
    case 'name':
      return a.name < b.name ? -1 : 1
    case 'time':
      return a.lastModifiedTimestamp - b.lastModifiedTimestamp
    case 'size':
      return a.size - b.size
    default:
      throw new Error('invalid SortBy: ' + s)
  }
}

const _sortByToDescComparer = (s: SortBy): PathItemComparer => {
  const asc = _sortByToAscComparer(s)
  return (a: PathItem, b: PathItem): number => -asc(a, b)
}

export const sortSettingToCompareFunction = (setting: SortSetting): Function =>
  setting.sortOrder === 'desc' ? _sortByToDescComparer(setting.sortBy) : _sortByToAscComparer(setting.sortBy)
