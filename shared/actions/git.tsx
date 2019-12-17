import * as ConfigGen from './config-gen'
import * as Constants from '../constants/git'
import * as RouteTreeGen from './route-tree-gen'
import * as GitGen from './git-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as Tabs from '../constants/tabs'
import {TypedState} from '../util/container'
import {logError} from '../util/errors'

const load = async (state: TypedState) => {
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

const createPersonalRepo = async (action: GitGen.CreatePersonalRepoPayload) => {
  try {
    await RPCTypes.gitCreatePersonalRepoRpcPromise(
      {repoName: action.payload.name},
      Constants.loadingWaitingKey
    )
    return GitGen.createRepoCreated()
  } catch (error) {
    return GitGen.createSetError({error})
  }
}

const createTeamRepo = async (action: GitGen.CreateTeamRepoPayload) => {
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
    return GitGen.createSetError({error})
  }
}

const deletePersonalRepo = async (action: GitGen.DeletePersonalRepoPayload) => {
  try {
    await RPCTypes.gitDeletePersonalRepoRpcPromise(
      {repoName: action.payload.name},
      Constants.loadingWaitingKey
    )
    return GitGen.createRepoDeleted()
  } catch (error) {
    return GitGen.createSetError({error})
  }
}

const deleteTeamRepo = async (action: GitGen.DeleteTeamRepoPayload) => {
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
    return GitGen.createSetError({error})
  }
}

const setTeamRepoSettings = async (action: GitGen.SetTeamRepoSettingsPayload) => {
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

function* navigateToTeamRepo(state: TypedState, action: GitGen.NavigateToTeamRepoPayload) {
  const {teamname, repoID} = action.payload
  let id = Constants.repoIDTeamnameToId(state, repoID, teamname)
  if (!id) {
    yield Saga.put(GitGen.createLoadGit())
    yield Saga.take(GitGen.loaded)
    const nextState: TypedState = yield* Saga.selectState()
    id = Constants.repoIDTeamnameToId(nextState, repoID, teamname)
  }

  if (id) {
    yield Saga.put(
      RouteTreeGen.createNavigateAppend({
        path: [Tabs.gitTab, {props: {expandedSet: new Set([id])}, selected: 'gitRoot'}],
      })
    )
  }
}

const receivedBadgeState = (action: NotificationsGen.ReceivedBadgeStatePayload) =>
  GitGen.createBadgeAppForGit({ids: new Set(action.payload.badgeState.newGitRepoGlobalUniqueIDs)})

function* gitSaga() {
  // Create / Delete
  yield* Saga.chainAction(GitGen.createPersonalRepo, createPersonalRepo)
  yield* Saga.chainAction(GitGen.createTeamRepo, createTeamRepo)
  yield* Saga.chainAction(GitGen.deletePersonalRepo, deletePersonalRepo)
  yield* Saga.chainAction(GitGen.deleteTeamRepo, deleteTeamRepo)
  yield* Saga.chainAction2([GitGen.repoCreated, GitGen.repoDeleted, GitGen.loadGit], load)

  // Team Repos
  yield* Saga.chainAction(GitGen.setTeamRepoSettings, setTeamRepoSettings)
  yield* Saga.chainGenerator<GitGen.NavigateToTeamRepoPayload>(GitGen.navigateToTeamRepo, navigateToTeamRepo)

  // Badges
  yield* Saga.chainAction(NotificationsGen.receivedBadgeState, receivedBadgeState)

  // clear on load
  yield* Saga.chainAction2(GitGen.loadGit, clearNavBadges)
}

export default gitSaga
