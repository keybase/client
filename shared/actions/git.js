// @flow
import * as ConfigGen from './config-gen'
import * as Constants from '../constants/git'
import * as GitGen from './git-gen'
import * as NotificationsGen from './notifications-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeTypes from '../constants/types/route-tree'
import * as RouteTreeConstants from '../constants/route-tree'
import * as Saga from '../util/saga'
import * as SettingsConstants from '../constants/settings'
import * as Tabs from '../constants/tabs'
import moment from 'moment'
import {isMobile} from '../constants/platform'
import {navigateTo, setRouteState} from './route-tree'
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

// Do we have to call loadgit?
const createPersonalRepo = (_, action: GitGen.CreatePersonalRepoPayload) =>
  RPCTypes.gitCreatePersonalRepoRpcPromise(
    {
      repoName: action.payload.name,
    },
    Constants.loadingWaitingKey
  )
    .then(() => GitGen.createNavToGit({routeState: null}))
    .catch(error => GitGen.createSetError({error}))

const createTeamRepo = (_, action: GitGen.CreateTeamRepoPayload) =>
  RPCTypes.gitCreateTeamRepoRpcPromise({
    notifyTeam: action.payload.notifyTeam,
    repoName: action.payload.name,
    teamName: {
      parts: action.payload.teamname.split('.'),
    },
  })
    .then(() => GitGen.createNavToGit({routeState: null}))
    .catch(error => GitGen.createSetError({error}))

const deletePersonalRepo = (_, action: GitGen.DeletePersonalRepoPayload) =>
  RPCTypes.gitDeletePersonalRepoRpcPromise({
    repoName: action.payload.name,
  })
    .then(() => GitGen.createNavToGit({routeState: null}))
    .catch(error => GitGen.createSetError({error}))

const deleteTeamRepo = (_, action: GitGen.DeleteTeamRepoPayload) =>
  RPCTypes.gitDeleteTeamRepoRpcPromise({
    notifyTeam: action.payload.notifyTeam,
    repoName: action.payload.name,
    teamName: {
      parts: action.payload.teamname.split('.'),
    },
  })
    .then(() => GitGen.createNavToGit({routeState: null}))
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
const clearBadgesAfterNav = (_, action: RouteTreeTypes.SwitchTo) => {
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

function handleIncomingGregor(_, action: GitGen.HandleIncomingGregorPayload) {
  const msgs = action.payload.messages.map(msg => JSON.parse(msg.body.toString()))
  for (let body of msgs) {
    const needsLoad = ['delete', 'create', 'update'].includes(body.action)
    if (needsLoad) {
      return Saga.put(GitGen.createLoadGit())
    }
  }
}

const navToGit = (_, action: GitGen.NavToGitPayload) => {
  const path = isMobile ? [Tabs.settingsTab, SettingsConstants.gitTab] : [Tabs.gitTab]
  const actions = [Saga.put(navigateTo(path, []))]
  if (action.payload.routeState) {
    actions.push(Saga.put(setRouteState(path, action.payload.routeState)))
  }
  return Saga.all(actions)
}

const isRepoInfoFresh = (lastLoad: ?number, maxAgeMs: number) => lastLoad && lastLoad - Date.now() < maxAgeMs

// Note: Needs to be sequential (& possibly refire) in order to match the repoID + teamname to a unique id
const navigateToTeamRepo = (state: TypedState, action: GitGen.NavigateToTeamRepoPayload) => {
  // If we haven't loaded the repos yet, or it is too old
  if (!isRepoInfoFresh(state.git.lastLoad, moment.duration(1, 'hour').asMilliseconds())) {
    return Saga.sequentially([
      Saga.put(GitGen.createLoadGit()),
      Saga.take(GitGen.loaded),
      // Refire the action
      Saga.put(action),
    ])
  }
  const {teamname, repoID} = action.payload
  const idToInfo = state.git.idToInfo
  const repo = idToInfo.find(val => val.repoID === repoID && val.teamname === teamname)
  if (!repo) {
    return
  }
  return Saga.put(GitGen.createNavToGit({routeState: {expandedSet: I.Set([repo.id])}}))
}

const receivedBadgeState = (state: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  Saga.put(GitGen.createBadgeAppForGit({ids: action.payload.badgeState.newGitRepoGlobalUniqueIDs || []}))

const clearError = () => Saga.put(GitGen.createSetError({error: null}))

function* gitSaga(): Saga.SagaGenerator<any, any> {
  // Create / Delete
  yield Saga.actionToAction(
    [GitGen.createPersonalRepo, GitGen.createTeamRepo, GitGen.deletePersonalRepo, GitGen.deleteTeamRepo],
    clearError
  )
  yield Saga.actionToPromise(GitGen.createPersonalRepo, createPersonalRepo)
  yield Saga.actionToPromise(GitGen.createTeamRepo, createTeamRepo)
  yield Saga.actionToPromise(GitGen.deletePersonalRepo, deletePersonalRepo)
  yield Saga.actionToPromise(GitGen.deleteTeamRepo, deleteTeamRepo)

  // Nav
  yield Saga.actionToAction(GitGen.navToGit, navToGit)

  // Loading
  yield Saga.actionToPromise(GitGen.loadGit, load)
  yield Saga.actionToPromise(GitGen.loadGitRepo, loadGitRepo)
  yield Saga.actionToAction(GitGen.loadGit, clearError)
  yield Saga.actionToAction(GitGen.loaded, surfaceGlobalErrors)

  // Team Repos
  yield Saga.actionToPromise(GitGen.setTeamRepoSettings, setTeamRepoSettings)
  yield Saga.actionToAction(GitGen.navigateToTeamRepo, navigateToTeamRepo)

  // Badges
  yield Saga.actionToAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  yield Saga.actionToPromise(RouteTreeConstants.switchTo, clearBadgesAfterNav)

  // Gregor
  yield Saga.actionToAction(GitGen.handleIncomingGregor, handleIncomingGregor)
}

export default gitSaga
