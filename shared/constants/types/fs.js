// @flow
import * as I from 'immutable'

export opaque type Path = ?string
export type FolderPathType = 'folder'
export type FilePathType = 'file' | 'symlink' | 'exec'
export opaque type PathType = FolderPathType | FilePathType
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
    case 'exec':
      return s
    default:
      // We don't do a flow check here because by now flow knows that we can't
      // be an empty string, so asserting empty will always fail.
      throw new Error('Invalid path type')
  }
}
export const pathTypeToString = (p: PathType): string => p
export const pathConcat = (p: Path, s: string): Path => stringToPath(pathToString(p) + '/' + s)
