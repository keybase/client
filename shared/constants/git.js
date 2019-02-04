// @flow
import * as I from 'immutable'
import * as Types from './types/git'
import * as RouteTree from '../route-tree'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as RPCTypes from './types/rpc-gen'
import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import moment from 'moment'
import type {TypedState} from './reducer'

export const makeGitInfo: I.RecordFactory<Types._GitInfo> = I.Record({
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

export const makeState: I.RecordFactory<Types._State> = I.Record({
  error: null,
  idToInfo: I.Map(),
  isNew: I.Set(),
})

const parseRepoResult = (result: RPCTypes.GitRepoResult): ?Types.GitInfo => {
  if (result.state === RPCTypes.gitGitRepoResultState.ok && result.ok) {
    const r: RPCTypes.GitRepoInfo = result.ok
    if (!r.folder.private) {
      // Skip public repos
      return null
    }
    const teamname = r.folder.folderType === RPCTypes.favoriteFolderType.team ? r.folder.name : null
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
  if (result.state === RPCTypes.gitGitRepoResultState.err && result.err) {
    errStr = result.err
  }
  return new Error(`Git repo error: ${errStr}`)
}

const parseRepos = (
  results: Array<RPCTypes.GitRepoResult>
): {|repos: {[key: string]: Types.GitInfo}, errors: Array<Error>|} => {
  let errors = []
  let repos = {}
  results.forEach(result => {
    if (result.state === RPCTypes.gitGitRepoResultState.ok && result.ok) {
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

const repoIDTeamnameToId = (state: TypedState, repoID: string, teamname: string): ?string => {
  const repo = state.git.idToInfo.find(val => val.repoID === repoID && val.teamname === teamname)
  if (!repo) {
    return
  }
  return repo.id
}

const getIdToGit = (state: TypedState) => state.git.idToInfo
const getError = (state: TypedState) => state.git.error
const loadingWaitingKey = 'git:loading'

const isLookingAtGit = (state: TypedState, action: RouteTreeGen.SwitchToPayload) => {
  const list = I.List(action.payload.path)
  const root = list.first()
  const settingsPath = RouteTree.getPath(state.routeTree.routeState, [Tabs.settingsTab])
  return (
    root === Tabs.gitTab || (root === Tabs.settingsTab && settingsPath.get(1) === SettingsConstants.gitTab)
  )
}

export {getIdToGit, getError, isLookingAtGit, loadingWaitingKey, parseRepos, repoIDTeamnameToId}
