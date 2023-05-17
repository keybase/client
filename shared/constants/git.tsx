import type * as Types from './types/git'

const emptyInfo = {
  canDelete: false,
  chatDisabled: false,
  devicename: '',
  id: '',
  lastEditTime: '',
  lastEditUser: '',
  name: '',
  repoID: '',
  url: '',
}
export const makeGitInfo = (i?: Partial<Types.GitInfo>): Types.GitInfo =>
  i ? Object.assign({...emptyInfo}, i) : emptyInfo

export const loadingWaitingKey = 'git:loading'
