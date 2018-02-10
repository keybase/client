// @flow
import * as I from 'immutable'

export opaque type Path = ?string

export type PathType = 'folder' | 'file' | 'symlink' | 'unknown'
export type ProgressType = 'pending' | 'loaded'

export type PathItemMetadata = {
  lastModifiedTimestamp?: number,
  size?: number,
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

export type PathBreadcrumbItem = {
  idx: number,
  name: string,
  path: string,
}

export type _State = {
  pathItems: I.Map<Path, PathItem>,
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
