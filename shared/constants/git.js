// @flow
import * as I from 'immutable'
import * as Types from './types/git'
import type {TypedState} from './reducer'

export const makeGitInfo: I.RecordFactory<Types._GitInfo> = I.Record({
  canDelete: false,
  devicename: '',
  id: '',
  lastEditTime: '',
  lastEditUser: '',
  name: '',
  repoID: '',
  teamname: null,
  url: '',
  channelName: null,
  chatDisabled: false,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  error: null,
  idToInfo: I.Map(),
  isNew: I.Set(),
})

const getIdToGit = (state: TypedState) => state.entities.getIn(['git', 'idToInfo'])
const getError = (state: TypedState) => state.entities.getIn(['git', 'error'])
const loadingWaitingKey = 'git:loading'

export {getIdToGit, getError, loadingWaitingKey}
