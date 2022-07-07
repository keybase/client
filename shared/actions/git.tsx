import * as ConfigGen from './config-gen'
import * as Constants from '../constants/git'
import * as RouteTreeGen from './route-tree-gen'
import * as GitGen from './git-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Tabs from '../constants/tabs'
import * as Container from '../util/container'
import {logError, RPCError} from '../util/errors'

const load = async (state: Container.TypedState) => {
  if (!state.config.loggedIn) {
    return false
  }

  try {
    const results = await RPCTypes.gitGetAllGitMetadataRpcPromise(undefined, Constants.loadingWaitingKey)
    const {errors, repos} = Constants.parseRepos(results || [])
    const errorActions = errors.map(globalError => ConfigGen.createGlobalError({globalError}))
    return [GitGen.createLoaded({repos}), ...errorActions]
  } catch (_) {
    return false
  }
}

const createPersonalRepo = async (_: unknown, action: GitGen.CreatePersonalRepoPayload) => {
  try {
    await RPCTypes.gitCreatePersonalRepoRpcPromise(
      {repoName: action.payload.name},
      Constants.loadingWaitingKey
    )
    return GitGen.createRepoCreated()
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return GitGen.createSetError({error})
  }
}

const createTeamRepo = async (_: unknown, action: GitGen.CreateTeamRepoPayload) => {
  try {
    await RPCTypes.gitCreateTeamRepoRpcPromise(
      {
        notifyTeam: action.payload.notifyTeam,
        repoName: action.payload.name,
        teamName: {parts: action.payload.teamname.split('.')},
      },
      Constants.loadingWaitingKey
    )
    return GitGen.createRepoCreated()
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return GitGen.createSetError({error})
  }
}

const deletePersonalRepo = async (_: unknown, action: GitGen.DeletePersonalRepoPayload) => {
  try {
    await RPCTypes.gitDeletePersonalRepoRpcPromise(
      {repoName: action.payload.name},
      Constants.loadingWaitingKey
    )
    return GitGen.createRepoDeleted()
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return GitGen.createSetError({error})
  }
}

const deleteTeamRepo = async (_: unknown, action: GitGen.DeleteTeamRepoPayload) => {
  try {
    await RPCTypes.gitDeleteTeamRepoRpcPromise(
      {
        notifyTeam: action.payload.notifyTeam,
        repoName: action.payload.name,
        teamName: {parts: action.payload.teamname.split('.')},
      },
      Constants.loadingWaitingKey
    )
    return GitGen.createRepoDeleted()
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    return GitGen.createSetError({error})
  }
}

const setTeamRepoSettings = async (_: unknown, action: GitGen.SetTeamRepoSettingsPayload) => {
  await RPCTypes.gitSetTeamRepoSettingsRpcPromise({
    channelName: action.payload.channelName,
    chatDisabled: action.payload.chatDisabled,
    folder: {
      created: false,
      folderType: RPCTypes.FolderType.team,
      name: action.payload.teamname,
    },
    repoID: action.payload.repoID,
  })
  return GitGen.createLoadGit()
}

const clearNavBadges = async () => {
  try {
    await RPCTypes.gregorDismissCategoryRpcPromise({category: 'new_git_repo'})
  } catch (e) {
    return logError(e)
  }
}

const navigateToTeamRepo = async (
  state: Container.TypedState,
  action: GitGen.NavigateToTeamRepoPayload,
  listenerApi: Container.ListenerApi
) => {
  const {teamname, repoID} = action.payload
  let id = Constants.repoIDTeamnameToId(state, repoID, teamname)
  if (!id) {
    listenerApi.dispatch(GitGen.createLoadGit())
    await listenerApi.take(action => action.type === GitGen.loaded)
    const nextState = listenerApi.getState()
    id = Constants.repoIDTeamnameToId(nextState, repoID, teamname)
  }

  if (id) {
    listenerApi.dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [Tabs.gitTab, {props: {expandedSet: new Set([id])}, selected: 'gitRoot'}],
      })
    )
  }
}

const receivedBadgeState = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  GitGen.createBadgeAppForGit({ids: new Set(action.payload.badgeState.newGitRepoGlobalUniqueIDs)})

const initGit = () => {
  // Create / Delete
  Container.listenAction(GitGen.createPersonalRepo, createPersonalRepo)
  Container.listenAction(GitGen.createTeamRepo, createTeamRepo)
  Container.listenAction(GitGen.deletePersonalRepo, deletePersonalRepo)
  Container.listenAction(GitGen.deleteTeamRepo, deleteTeamRepo)
  Container.listenAction([GitGen.repoCreated, GitGen.repoDeleted, GitGen.loadGit], load)

  // Team Repos
  Container.listenAction(GitGen.setTeamRepoSettings, setTeamRepoSettings)
  Container.listenAction(GitGen.navigateToTeamRepo, navigateToTeamRepo)

  // Badges
  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)

  // clear on load
  Container.listenAction(GitGen.loadGit, clearNavBadges)
}

export default initGit
