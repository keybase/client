import * as Types from './types/git'
import * as RPCTypes from './types/rpc-gen'
import moment from 'moment'
import {TypedState} from './reducer'

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

const parseRepoResult = (result: RPCTypes.GitRepoResult): Types.GitInfo | undefined => {
  if (result.state === RPCTypes.GitRepoResultState.ok && result.ok) {
    const r: RPCTypes.GitRepoInfo = result.ok
    if (r.folder.folderType === RPCTypes.FolderType.public) {
      // Skip public repos
      return undefined
    }
    const teamname = r.folder.folderType === RPCTypes.FolderType.team ? r.folder.name : undefined
    return {
      canDelete: r.canDelete,
      channelName: (r.teamRepoSettings && r.teamRepoSettings.channelName) || undefined,
      chatDisabled: !!r.teamRepoSettings && r.teamRepoSettings.chatDisabled,
      devicename: r.serverMetadata.lastModifyingDeviceName,
      id: r.globalUniqueID,
      lastEditTime: moment(r.serverMetadata.mtime).fromNow(),
      lastEditUser: r.serverMetadata.lastModifyingUsername,
      name: r.localMetadata.repoName,
      repoID: r.repoID,
      teamname,
      url: r.repoUrl,
    }
  }
  return undefined
}

const parseRepoError = (result: RPCTypes.GitRepoResult): Error => {
  let errStr: string = 'unknown'
  if (result.state === RPCTypes.GitRepoResultState.err && result.err) {
    errStr = result.err
  }
  return new Error(`Git repo error: ${errStr}`)
}

export const parseRepos = (results: Array<RPCTypes.GitRepoResult>) => {
  let errors: Array<Error> = []
  let repos = new Map<string, Types.GitInfo>()
  results.forEach(result => {
    if (result.state === RPCTypes.GitRepoResultState.ok && result.ok) {
      const parsedRepo = parseRepoResult(result)
      if (parsedRepo) {
        repos.set(parsedRepo.id, parsedRepo)
      }
    } else {
      errors.push(parseRepoError(result))
    }
  })
  return {errors, repos}
}

export const repoIDTeamnameToId = (state: TypedState, repoID: string, teamname: string) => {
  let repo: undefined | Types.GitInfo
  for (let [, info] of state.git.idToInfo) {
    if (info.repoID === repoID && info.teamname === teamname) {
      repo = info
      break
    }
  }
  return repo ? repo.id : undefined
}

export const getIdToGit = (state: TypedState) => state.git.idToInfo
export const getError = (state: TypedState) => state.git.error
export const loadingWaitingKey = 'git:loading'
