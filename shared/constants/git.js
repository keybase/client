// @flow
import * as I from 'immutable'
import {type NoErrorTypedAction} from './types/flux'
import {type TypedState} from './reducer'
import {type OutOfBandMessage} from './types/flow-types-gregor'

export type LoadGit = NoErrorTypedAction<'git:loadGit', void>
export type CreateTeamRepo = NoErrorTypedAction<
  'git:createTeamRepo',
  {name: string, teamname: string, notifyTeam: boolean}
>
export type CreatePersonalRepo = NoErrorTypedAction<'git:createPersonalRepo', {name: string}>
export type DeleteTeamRepo = NoErrorTypedAction<
  'git:deleteTeamRepo',
  {name: string, teamname: string, notifyTeam: boolean}
>
export type DeletePersonalRepo = NoErrorTypedAction<'git:deletePersonalRepo', {name: string}>
export type SetLoading = NoErrorTypedAction<'git:setLoading', {loading: boolean}>
export type SetError = NoErrorTypedAction<'git:setError', {gitError: ?Error}>
export type BadgeAppForGit = NoErrorTypedAction<'git:badgeAppForGit', {ids: Array<string>}>
export type HandleIncomingGregor = NoErrorTypedAction<
  'git:handleIncomingGregor',
  {messages: Array<OutOfBandMessage>}
>

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
