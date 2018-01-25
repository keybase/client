// @flow
import * as I from 'immutable'

export opaque type Path = ?string
export type PathType = 'folder' | 'file' | 'symlink' | 'exec'
type FolderPathType = 'folder'
type FilePathType = 'file' | 'symlink' | 'exec'
export type _FilePathItem = {
  type: FilePathType,
}
export type _FolderPathItem = {
  type: FolderPathType,
  children: I.List<string>,
}
export type PathItem = I.RecordOf<_FolderPathItem> | I.RecordOf<_FilePathItem>
export type PathItems = I.Map<Path, PathItem>

export type _State = {
  pathItems: PathItems,
}
export type State = I.RecordOf<_State>

export type Visibility = 'private' | 'public' | 'team' | null

export const stringToPath = (s: string): Path => (s.indexOf('/keybase') !== -1 ? s : null)
export const pathToString = (p: Path): string => (!p ? '' : p)
export const getPathName = (p: Path): string => (!p ? '' : p.split('/').pop())
export const getPathVisibility = (p: Path): Visibility => {
  if (!p) return null
  const [, , visibility] = p.split('/')
  if (!visibility) {
    return null
  }
  switch (visibility) {
    case 'private':
    case 'public':
    case 'team':
      return visibility
    case null:
      return null
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(visibility: empty) // if you get a flow error here it means there's an visibility you claim to handle but didn't
      return null
  }
}
export const pathConcat = (p: Path, s: string): Path => stringToPath(pathToString(p) + '/' + s)
