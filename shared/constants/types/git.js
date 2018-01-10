// @flow
import * as I from 'immutable'

export type _GitInfo = {
  canDelete: boolean,
  devicename: string,
  id: string,
  lastEditTime: string,
  lastEditUser: string,
  name: string,
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
  loading: boolean,
}
export type State = I.RecordOf<_State>
