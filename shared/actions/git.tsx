import * as ConfigGen from './config-gen'
import * as GregorGen from './gregor-gen'
import * as Constants from '../constants/git'
import * as GitGen from './git-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
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

const createPersonalRepo = async (_: TypedState, action: GitGen.CreatePersonalRepoPayload) => {
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

const createTeamRepo = async (_: TypedState, action: GitGen.CreateTeamRepoPayload) => {
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

const deletePersonalRepo = async (_: TypedState, action: GitGen.DeletePersonalRepoPayload) => {
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

const deleteTeamRepo = async (_: TypedState, action: GitGen.DeleteTeamRepoPayload) => {
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

const setTeamRepoSettings = async (_: TypedState, action: GitGen.SetTeamRepoSettingsPayload) => {
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

const handleIncomingGregor = (_: TypedState, action: GregorGen.PushOOBMPayload) => {
  const gitMessages = action.payload.messages.filter(i => i.system === 'git')
  const msgs = gitMessages.map(msg => JSON.parse(msg.body.toString()))
  for (let body of msgs) {
    const needsLoad = ['delete', 'create', 'update'].includes(body.action)
    if (needsLoad) {
      return GitGen.createLoadGit()
    }
  }
  return false
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
    yield Saga.put(GitGen.createNavToGit({routeState: {expandedSet: new Set([id])}, switchTab: true}))
  }
}

const receivedBadgeState = (_: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  GitGen.createBadgeAppForGit({ids: new Set(action.payload.badgeState.newGitRepoGlobalUniqueIDs)})

function* gitSaga(): Saga.SagaGenerator<any, any> {
  // Create / Delete
  yield* Saga.chainAction2(GitGen.createPersonalRepo, createPersonalRepo)
  yield* Saga.chainAction2(GitGen.createTeamRepo, createTeamRepo)
  yield* Saga.chainAction2(GitGen.deletePersonalRepo, deletePersonalRepo)
  yield* Saga.chainAction2(GitGen.deleteTeamRepo, deleteTeamRepo)
  yield* Saga.chainAction2([GitGen.repoCreated, GitGen.repoDeleted, GitGen.loadGit], load)

  // Team Repos
  yield* Saga.chainAction2(GitGen.setTeamRepoSettings, setTeamRepoSettings)
  yield* Saga.chainGenerator<GitGen.NavigateToTeamRepoPayload>(GitGen.navigateToTeamRepo, navigateToTeamRepo)

  // Badges
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState)

  // clear on load
  yield* Saga.chainAction2(GitGen.loadGit, clearNavBadges)

  // Gregor
  yield* Saga.chainAction2(GregorGen.pushOOBM, handleIncomingGregor)
}

export default gitSaga
