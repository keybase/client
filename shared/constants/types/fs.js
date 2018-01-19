// @flow
import * as I from 'immutable'

export type _State = {
  counter: number,
}

export type State = I.RecordOf<_State>

export type FolderVisibility = 'private' | 'public' | 'team' | null

export type FolderHeaderProps = {
  title: string,
}

export type FileRowProps = {
  path: string,
  icon: IconType,
  showFileData: () => void,
}

export type FolderProps = {
  path: string,
  visibility: FolderVisibility,
  items: Array<string>,
}
