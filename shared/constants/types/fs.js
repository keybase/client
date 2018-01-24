// @flow
import * as I from 'immutable'

export opaque type Path = ?string
export type PathType = 'folder' | 'file' | 'symlink' | 'exec'
export type _PathItem = | {
  type: 'file',
} | {
  type: 'folder' | 'symlink' | 'exec',
  children: I.List<string>,
}
type PathItem = I.RecordOf<_PathItem>

export type _State = {
  path: Path,
  pathItems: I.Map<Path, PathItem>,
}
export type State = I.RecordOf<_State>

export type Visibility = 'private' | 'public' | 'team' | null

export const stringToPath = (s: string): Path => s.indexOf('/keybase') != -1 ? s : null
export const getPathName = (p: Path): string => p === null ? '' : p.split('/').pop()
export const getPathVisibility = (p: Path): Visibility => {
  if (p === null) return null
  const pelems = p.split('/')
  return pelems.length < 3 ? null : pelems[2]
}
export const pathConcat = (p: Path, s: string): Path => p + '/' + s
