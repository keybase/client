import * as I from 'immutable'
import * as Types from './types/git'
import * as RPCTypes from './types/rpc-gen'
import moment from 'moment'
import {TypedState} from './reducer'

export const makeGitInfo = I.Record<Types._GitInfo>({
  canDelete: false,
  channelName: null,
  chatDisabled: false,
  devicename: '',
  id: '',
  lastEditTime: '',
  lastEditUser: '',
  name: '',
  repoID: '',
  teamname: null,
  url: '',
})

export const makeState = I.Record<Types._State>({
  error: null,
  idToInfo: I.Map(),
  isNew: I.Set(),
})

const parseRepoResult = (result: RPCTypes.GitRepoResult): Types.GitInfo | null => {
  if (result.state === RPCTypes.GitRepoResultState.ok && result.ok) {
    const r: RPCTypes.GitRepoInfo = result.ok
    if (r.folder.folderType === RPCTypes.FolderType.public) {
      // Skip public repos
      return null
    }
    const teamname = r.folder.folderType === RPCTypes.FolderType.team ? r.folder.name : null
    return makeGitInfo({
      canDelete: r.canDelete,
      channelName: (r.teamRepoSettings && r.teamRepoSettings.channelName) || null,
      chatDisabled: !!r.teamRepoSettings && r.teamRepoSettings.chatDisabled,
      devicename: r.serverMetadata.lastModifyingDeviceName,
      id: r.globalUniqueID,
      lastEditTime: moment(r.serverMetadata.mtime).fromNow(),
      lastEditUser: r.serverMetadata.lastModifyingUsername,
      name: r.localMetadata.repoName,
      repoID: r.repoID,
      teamname,
      url: r.repoUrl,
    })
  }
  return null
}

const parseRepoError = (result: RPCTypes.GitRepoResult): Error => {
  let errStr: string = 'unknown'
  if (result.state === RPCTypes.GitRepoResultState.err && result.err) {
    errStr = result.err
  }
  return new Error(`Git repo error: ${errStr}`)
}

export const parseRepos = (
  results: Array<RPCTypes.GitRepoResult>
): {
  repos: {[K in string]: Types.GitInfo}
  errors: Array<Error>
} => {
  let errors = []
  let repos = {}
  results.forEach(result => {
    if (result.state === RPCTypes.GitRepoResultState.ok && result.ok) {
      const parsedRepo = parseRepoResult(result)
      if (parsedRepo) {
        repos[parsedRepo.id] = parsedRepo
      }
    } else {
      errors.push(parseRepoError(result))
    }
  })
  return {
    errors,
    repos,
  }
}

export const repoIDTeamnameToId = (state: TypedState, repoID: string, teamname: string): string | null => {
  const repo = state.git.idToInfo.find(val => val.repoID === repoID && val.teamname === teamname)
  if (!repo) {
    return
  }
  return repo.id
}

export const getIdToGit = (state: TypedState) => state.git.idToInfo
export const getError = (state: TypedState) => state.git.error
export const loadingWaitingKey = 'git:loading'
