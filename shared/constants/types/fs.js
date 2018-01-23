// @flow
import * as I from 'immutable'

export type _State = {
  path: Path,
  pathItems: I.Map<Path, PathItem>,
}

export type State = I.RecordOf<_State>

export type PathItem = {
  type: PathType,
  children: I.List<string> | null,
}

export type Visibility = 'private' | 'public' | 'team' | null

export type PathType = 'folder' | 'file' | 'symlink' | 'exec'

export opaque type Path = string | null

export const stringToPath = (s: string): Path => s.indexOf('/keybase') != -1 ? s : null
export const getPathName = (p: Path): string => p.split('/').pop()
export const getPathVisibility = (p: Path): Visibility => {
  const pelems = p.split('/')
  return pelems.length < 3 ? null : pelems[2]
}
export const pathConcat = (p: Path, s: string): Path => p + '/' + s
