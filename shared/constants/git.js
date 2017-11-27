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
  teamname: null,
  url: '',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  error: null,
  idToInfo: I.Map(),
  isNew: I.Set(),
  loading: false,
})

const getIdToGit = (state: TypedState) => state.entities.getIn(['git', 'idToInfo'])
const getError = (state: TypedState) => state.entities.getIn(['git', 'error'])
const getLoading = (state: TypedState) => state.entities.getIn(['git', 'loading'])

export {getIdToGit, getError, getLoading}
