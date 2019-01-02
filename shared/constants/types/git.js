// @flow strict
import * as I from 'immutable'

export type _GitInfo = {
  canDelete: boolean,
  devicename: string,
  id: string, // 'Global Unique ID'
  lastEditTime: string,
  lastEditUser: string,
  name: string,
  repoID: string, // repoID daemon is concerned with
  teamname: ?string,
  url: string,
  channelName: ?string,
  chatDisabled: boolean,
}
export type GitInfo = I.RecordOf<_GitInfo>
export type _State = {
  error: ?Error,
  idToInfo: I.Map<string, GitInfo>,
  isNew: I.Set<string>,
}
export type State = I.RecordOf<_State>
