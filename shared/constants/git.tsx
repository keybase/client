import type * as Types from './types/git'
import * as dateFns from 'date-fns'
import * as ConfigGen from '../actions/config-gen'
import * as GitGen from '../actions/git-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import {logError, RPCError} from '../util/errors'

const parseRepos = (results: Array<RPCTypes.GitRepoResult>) => {
  const errors: Array<Error> = []
  const repos = new Map<string, Types.GitInfo>()
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
      lastEditTime: dateFns.formatDistanceToNow(new Date(r.serverMetadata.mtime), {addSuffix: true}),
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

const clearNavBadges = async () => {
  try {
    await RPCTypes.gregorDismissCategoryRpcPromise({category: 'new_git_repo'})
  } catch (e) {
    return logError(e)
  }
}

export const useGitState = Container.createZustand(
  Container.immerZustand<Types.State>(_set => ({
    dispatchLoad: async () => {
      await clearNavBadges()
      const results = await RPCTypes.gitGetAllGitMetadataRpcPromise(undefined, loadingWaitingKey)
      const {errors, repos} = parseRepos(results || [])
      const errorActions = errors.map(globalError => ConfigGen.createGlobalError({globalError}))
      const actions = [GitGen.createLoaded({repos}), ...errorActions]
      actions.forEach(a => Container.getGlobalStore().dispatch(a))
    },
    error: undefined,
    idToInfo: new Map(),
    isNew: new Set(),
  }))
)

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
