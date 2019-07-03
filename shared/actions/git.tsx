import * as ConfigGen from './config-gen'
import * as GregorGen from './gregor-gen'
import * as Constants from '../constants/git'
import * as GitGen from './git-gen'
import * as NotificationsGen from './notifications-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import {TypedState} from '../util/container'
import {logError} from '../util/errors'

const load = (state: TypedState) =>
  state.config.loggedIn &&
  RPCTypes.gitGetAllGitMetadataRpcPromise(undefined, Constants.loadingWaitingKey)
    .then((results: Array<RPCTypes.GitRepoResult> | null) =>
      // @ts-ignore codemod-issue
      GitGen.createLoaded(Constants.parseRepos(results || []))
    )
    .catch(() => {})

const surfaceGlobalErrors = (_, {payload: {errors}}: GitGen.LoadedPayload) =>
  errors.map(globalError => ConfigGen.createGlobalError({globalError}))

const createPersonalRepo = (_, action: GitGen.CreatePersonalRepoPayload) =>
  RPCTypes.gitCreatePersonalRepoRpcPromise(
    {
      repoName: action.payload.name,
    },
    Constants.loadingWaitingKey
  )
    .then(() => GitGen.createRepoCreated())
    .catch(error => GitGen.createSetError({error}))

const createTeamRepo = (_, action: GitGen.CreateTeamRepoPayload) =>
  RPCTypes.gitCreateTeamRepoRpcPromise(
    {
      notifyTeam: action.payload.notifyTeam,
      repoName: action.payload.name,
      teamName: {
        parts: action.payload.teamname.split('.'),
      },
    },
    Constants.loadingWaitingKey
  )
    .then(() => GitGen.createRepoCreated())
    .catch(error => GitGen.createSetError({error}))

const deletePersonalRepo = (_, action: GitGen.DeletePersonalRepoPayload) =>
  RPCTypes.gitDeletePersonalRepoRpcPromise(
    {
      repoName: action.payload.name,
    },
    Constants.loadingWaitingKey
  )
    .then(() => GitGen.createRepoDeleted())
    .catch(error => GitGen.createSetError({error}))

const deleteTeamRepo = (_, action: GitGen.DeleteTeamRepoPayload) =>
  RPCTypes.gitDeleteTeamRepoRpcPromise(
    {
      notifyTeam: action.payload.notifyTeam,
      repoName: action.payload.name,
      teamName: {
        parts: action.payload.teamname.split('.'),
      },
    },
    Constants.loadingWaitingKey
  )
    .then(() => GitGen.createRepoDeleted())
    .catch(error => GitGen.createSetError({error}))

const setTeamRepoSettings = (_, action: GitGen.SetTeamRepoSettingsPayload) =>
  RPCTypes.gitSetTeamRepoSettingsRpcPromise({
    channelName: action.payload.channelName,
    chatDisabled: action.payload.chatDisabled,
    folder: {
      created: false,
      folderType: RPCTypes.FolderType.team,
      name: action.payload.teamname,
    },
    repoID: action.payload.repoID,
  }).then(() => GitGen.createLoadGit())

const clearNavBadges = () =>
  RPCTypes.gregorDismissCategoryRpcPromise({
    category: 'new_git_repo',
  }).catch(logError)

const handleIncomingGregor = (_, action: GregorGen.PushOOBMPayload) => {
  const gitMessages = action.payload.messages.filter(i => i.system === 'git')
  const msgs = gitMessages.map(msg => JSON.parse(msg.body.toString()))
  for (let body of msgs) {
    const needsLoad = ['delete', 'create', 'update'].includes(body.action)
    if (needsLoad) {
      return GitGen.createLoadGit()
    }
  }
}

function* navigateToTeamRepo(state, action: GitGen.NavigateToTeamRepoPayload) {
  const {teamname, repoID} = action.payload
  let id = Constants.repoIDTeamnameToId(state, repoID, teamname)
  if (!id) {
    yield Saga.put(GitGen.createLoadGit())
    yield Saga.take(GitGen.loaded)
    const nextState = yield* Saga.selectState()
    id = Constants.repoIDTeamnameToId(nextState, repoID, teamname)
  }

  if (id) {
    yield Saga.put(GitGen.createNavToGit({routeState: {expandedSet: I.Set([id])}, switchTab: true}))
  }
}

const receivedBadgeState = (_, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  GitGen.createBadgeAppForGit({ids: action.payload.badgeState.newGitRepoGlobalUniqueIDs || []})

function* gitSaga(): Saga.SagaGenerator<any, any> {
  // Create / Delete
  yield* Saga.chainAction<GitGen.CreatePersonalRepoPayload>(GitGen.createPersonalRepo, createPersonalRepo)
  yield* Saga.chainAction<GitGen.CreateTeamRepoPayload>(GitGen.createTeamRepo, createTeamRepo)
  yield* Saga.chainAction<GitGen.DeletePersonalRepoPayload>(GitGen.deletePersonalRepo, deletePersonalRepo)
  yield* Saga.chainAction<GitGen.DeleteTeamRepoPayload>(GitGen.deleteTeamRepo, deleteTeamRepo)
  yield* Saga.chainAction<GitGen.RepoCreatedPayload | GitGen.RepoDeletedPayload | GitGen.LoadGitPayload>(
    [GitGen.repoCreated, GitGen.repoDeleted, GitGen.loadGit],
    load
  )

  // Loading
  yield* Saga.chainAction<GitGen.LoadedPayload>(GitGen.loaded, surfaceGlobalErrors)

  // Team Repos
  yield* Saga.chainAction<GitGen.SetTeamRepoSettingsPayload>(GitGen.setTeamRepoSettings, setTeamRepoSettings)
  yield* Saga.chainGenerator<GitGen.NavigateToTeamRepoPayload>(GitGen.navigateToTeamRepo, navigateToTeamRepo)

  // Badges
  yield* Saga.chainAction<NotificationsGen.ReceivedBadgeStatePayload>(
    NotificationsGen.receivedBadgeState,
    receivedBadgeState
  )

  // clear on load
  yield* Saga.chainAction<GitGen.LoadGitPayload>(GitGen.loadGit, clearNavBadges)

  // Gregor
  yield* Saga.chainAction<GregorGen.PushOOBMPayload>(GregorGen.pushOOBM, handleIncomingGregor)
}

export default gitSaga
