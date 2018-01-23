// @flow
import * as I from 'immutable'

export type _State = {
  name: string,
  path: FolderPath,
  visibility: FolderVisibility,
}

export type State = I.RecordOf<_State>

export type FolderPath = string

export type FolderVisibility = 'private' | 'public' | 'team' | null

