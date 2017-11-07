// @flow
import * as I from 'immutable'
import {type TypedState} from './reducer'

type _GitInfo = {
  canDelete: boolean,
  devicename: string,
  id: string,
  lastEditTime: string,
  lastEditUser: string,
  name: string,
  teamname: ?string,
  url: string,
}
export type GitInfo = I.RecordOf<_GitInfo>
export const makeGitInfo: I.RecordFactory<_GitInfo> = I.Record({
  canDelete: false,
  devicename: '',
  id: '',
  lastEditTime: '',
  lastEditUser: '',
  name: '',
  teamname: null,
  url: '',
})

type _State = {
  error: ?Error,
  idToInfo: I.Map<string, GitInfo>,
  isNew: I.Set<string>,
  loading: boolean,
}
export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  error: null,
  idToInfo: I.Map(),
  isNew: I.Set(),
  loading: false,
})

const getIdToGit = (state: TypedState) => state.entities.getIn(['git', 'idToInfo'])
const getError = (state: TypedState) => state.entities.getIn(['git', 'error'])
const getLoading = (state: TypedState) => state.entities.getIn(['git', 'loading'])

export {getIdToGit, getError, getLoading}
