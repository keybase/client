import * as I from 'immutable'

export type _GitInfo = {
  canDelete: boolean,
  devicename: string,
  id: string,
  lastEditTime: string,
  lastEditUser: string,
  name: string,
  repoID: string,
  teamname: string | null,
  url: string,
  channelName: string | null,
  chatDisabled: boolean
};
export type GitInfo = I.RecordOf<_GitInfo>;
export type _State = {
  error: Error | null,
  idToInfo: I.Map<string, GitInfo>,
  isNew: I.Set<string>
};
export type State = I.RecordOf<_State>;
