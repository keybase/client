// @flow
import * as ConfigGen from './config-gen'
import * as GregorGen from './gregor-gen'
import * as Constants from '../constants/git'
import * as GitGen from './git-gen'
import * as NotificationsGen from './notifications-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as SettingsConstants from '../constants/settings'
import * as Tabs from '../constants/tabs'
import {isMobile} from '../constants/platform'
import type {TypedState} from '../util/container'
import {logError} from '../util/errors'

const load = (state: TypedState) =>
  state.config.loggedIn &&
  RPCTypes.gitGetAllGitMetadataRpcPromise(undefined, Constants.loadingWaitingKey)
    .then((results: ?Array<RPCTypes.GitRepoResult>) =>
      GitGen.createLoaded(Constants.parseRepos(results || []))
    )
    .catch(() => {})

const loadGitRepo = (state: TypedState, action: GitGen.LoadGitRepoPayload) =>
  state.config.loggedIn &&
  RPCTypes.gitGetGitMetadataRpcPromise(
    {
      folder: {
        created: false,
        folderType: action.payload.teamname
          ? RPCTypes.favoriteFolderType.team
          : RPCTypes.favoriteFolderType.private,
        name: action.payload.teamname || action.payload.username || '',
        notificationsOn: false,
        private: true,
      },
    },
    Constants.loadingWaitingKey
  )
    .then((results: ?Array<RPCTypes.GitRepoResult>) =>
      GitGen.createLoaded(Constants.parseRepos(results || []))
    )
    .catch(() => {})

const surfaceGlobalErrors = (_, {payload: {errors}}: GitGen.LoadedPayload) =>
  Saga.all(errors.map(globalError => Saga.put(ConfigGen.createGlobalError({globalError}))))

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
  RPCTypes.gitCreateTeamRepoRpcPromise({
    notifyTeam: action.payload.notifyTeam,
    repoName: action.payload.name,
    teamName: {
      parts: action.payload.teamname.split('.'),
    },
  })
    .then(() => GitGen.createRepoCreated())
    .catch(error => GitGen.createSetError({error}))

const deletePersonalRepo = (_, action: GitGen.DeletePersonalRepoPayload) =>
  RPCTypes.gitDeletePersonalRepoRpcPromise({
    repoName: action.payload.name,
  })
    .then(() => GitGen.createRepoDeleted())
    .catch(error => GitGen.createSetError({error}))

const deleteTeamRepo = (_, action: GitGen.DeleteTeamRepoPayload) =>
  RPCTypes.gitDeleteTeamRepoRpcPromise({
    notifyTeam: action.payload.notifyTeam,
    repoName: action.payload.name,
    teamName: {
      parts: action.payload.teamname.split('.'),
    },
  })
    .then(() => GitGen.createRepoDeleted())
    .catch(error => GitGen.createSetError({error}))

const setTeamRepoSettings = (_, action: GitGen.SetTeamRepoSettingsPayload) =>
  RPCTypes.gitSetTeamRepoSettingsRpcPromise({
    folder: {
      name: action.payload.teamname,
      folderType: RPCTypes.favoriteFolderType.team,
      private: true,
      created: false,
      notificationsOn: false,
    },
    repoID: action.payload.repoID,
    channelName: action.payload.channelName,
    chatDisabled: action.payload.chatDisabled,
  }).then(() => GitGen.createLoadGitRepo({teamname: action.payload.teamname, username: null}))

let _wasOnGitTab = false
const clearBadgesAfterNav = (_, action: RouteTreeGen.SwitchToPayload) => {
  // on the git tab?
  const list = I.List(action.payload.path)
  const root = list.first()

  if (root === Tabs.gitTab) {
    _wasOnGitTab = true
  } else if (_wasOnGitTab) {
    _wasOnGitTab = false
    // clear badges
    return RPCTypes.gregorDismissCategoryRpcPromise({
      category: 'new_git_repo',
    }).catch(logError)
  }

  return null
}

function handleIncomingGregor(_, action: GregorGen.PushOOBMPayload) {
  const gitMessages = action.payload.messages.filter(i => i.system === 'git')
  const msgs = gitMessages.map(msg => JSON.parse(msg.body.toString()))
  for (let body of msgs) {
    const needsLoad = ['delete', 'create', 'update'].includes(body.action)
    if (needsLoad) {
      return Saga.put(GitGen.createLoadGit())
    }
  }
}

const navToGit = (_, action: GitGen.NavToGitPayload) => {
  const {routeState} = action.payload
  const path = isMobile ? [Tabs.settingsTab, SettingsConstants.gitTab] : [Tabs.gitTab]
  const parentPath = []
  const actions = [Saga.put(RouteTreeGen.createNavigateTo({path, parentPath}))]
  if (routeState) {
    actions.push(Saga.put(RouteTreeGen.createSetRouteState({path, partialState: routeState})))
  }
  return Saga.all(actions)
}

const navigateToTeamRepo = (state: TypedState, action: GitGen.NavigateToTeamRepoPayload) =>
  Saga.call(function*() {
    const {teamname, repoID} = action.payload
    let id = Constants.repoIDTeamnameToId(state, repoID, teamname)
    if (!id) {
      yield Saga.put(GitGen.createLoadGit())
      yield Saga.take(GitGen.loaded)
      const nextState = yield Saga.select()
      id = Constants.repoIDTeamnameToId(nextState, repoID, teamname)
    }

    if (id) {
      yield Saga.put(GitGen.createNavToGit({routeState: {expandedSet: I.Set([id])}, switchTab: true}))
    }
  })

const receivedBadgeState = (state: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  Saga.put(GitGen.createBadgeAppForGit({ids: action.payload.badgeState.newGitRepoGlobalUniqueIDs || []}))

function* gitSaga(): Saga.SagaGenerator<any, any> {
  // Create / Delete
  yield Saga.actionToPromise(GitGen.createPersonalRepo, createPersonalRepo)
  yield Saga.actionToPromise(GitGen.createTeamRepo, createTeamRepo)
  yield Saga.actionToPromise(GitGen.deletePersonalRepo, deletePersonalRepo)
  yield Saga.actionToPromise(GitGen.deleteTeamRepo, deleteTeamRepo)
  yield Saga.actionToPromise([GitGen.repoCreated, GitGen.repoDeleted], load)

  // Nav
  yield Saga.actionToAction(GitGen.navToGit, navToGit)
  yield Saga.actionToAction([GitGen.repoCreated, GitGen.repoDeleted], () =>
    Saga.put(GitGen.createNavToGit({routeState: null, switchTab: false}))
  )

  // Loading
  yield Saga.actionToPromise(GitGen.loadGit, load)
  yield Saga.actionToPromise(GitGen.loadGitRepo, loadGitRepo)
  yield Saga.actionToAction(GitGen.loaded, surfaceGlobalErrors)

  // Team Repos
  yield Saga.actionToPromise(GitGen.setTeamRepoSettings, setTeamRepoSettings)
  yield Saga.actionToAction(GitGen.navigateToTeamRepo, navigateToTeamRepo)

  // Badges
  yield Saga.actionToAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  yield Saga.actionToPromise(RouteTreeGen.switchTo, clearBadgesAfterNav)

  // Gregor
  yield Saga.actionToAction(GregorGen.pushOOBM, handleIncomingGregor)
}

export default gitSaga
