// @flow
import * as ConfigGen from './config-gen'
import * as Constants from '../constants/git'
import * as GitGen from './git-gen'
import * as Entities from './entities'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeTypes from '../constants/types/route-tree'
import * as RouteTreeConstants from '../constants/route-tree'
import * as Saga from '../util/saga'
import * as SettingsConstants from '../constants/settings'
import * as Tabs from '../constants/tabs'
import moment from 'moment'
import {isMobile} from '../constants/platform'
import {navigateTo} from './route-tree'

function* _loadGit(action: GitGen.LoadGitPayload): Saga.SagaGenerator<any, any> {
  yield Saga.put(GitGen.createSetError({error: null}))
  yield Saga.put(GitGen.createSetLoading({loading: true}))

  try {
    const results: Array<RPCTypes.GitRepoResult> = yield Saga.call(RPCTypes.gitGetAllGitMetadataRpcPromise) ||
      []

    let idToInfo = {}

    for (let i = 0; i < results.length; i++) {
      const repoResult = results[i]
      if (repoResult.state === RPCTypes.gitGitRepoResultState.ok && repoResult.ok) {
        const r: RPCTypes.GitRepoInfo = repoResult.ok
        if (!r.folder.private) {
          // Skip public repos
          continue
        }
        const teamname = r.folder.folderType === RPCTypes.favoriteFolderType.team ? r.folder.name : null
        idToInfo[r.globalUniqueID] = Constants.makeGitInfo({
          canDelete: r.canDelete,
          devicename: r.serverMetadata.lastModifyingDeviceName,
          id: r.globalUniqueID,
          lastEditTime: moment(r.serverMetadata.mtime).fromNow(),
          lastEditUser: r.serverMetadata.lastModifyingUsername,
          name: r.localMetadata.repoName,
          teamname,
          url: r.repoUrl,
        })
      } else {
        let errStr: string = 'unknown'
        if (repoResult.state === RPCTypes.gitGitRepoResultState.err && repoResult.err) {
          errStr = repoResult.err
        }
        yield Saga.put(
          ConfigGen.createGlobalError({
            globalError: new Error(`Git repo error: ${errStr}`),
          })
        )
      }
    }

    yield Saga.put(Entities.replaceEntity(['git'], I.Map({idToInfo: I.Map(idToInfo)})))
  } finally {
    yield Saga.put(GitGen.createSetLoading({loading: false}))
  }
}

// reset errors and set loading, make a call and either go back to the root or show an error
function* _createDeleteHelper(theCall: *): Generator<any, void, any> {
  yield Saga.put.resolve(GitGen.createSetError({error: null}))
  yield Saga.put.resolve(GitGen.createSetLoading({loading: true}))
  try {
    yield theCall
    yield Saga.put(navigateTo(isMobile ? [Tabs.settingsTab, SettingsConstants.gitTab] : [Tabs.gitTab], []))
    yield Saga.put.resolve(GitGen.createSetLoading({loading: false}))
    yield Saga.put(GitGen.createLoadGit())
  } catch (err) {
    yield Saga.put(GitGen.createSetError({error: err}))
    yield Saga.put.resolve(GitGen.createSetLoading({loading: false}))
  } finally {
    // just in case
    yield Saga.put.resolve(GitGen.createSetLoading({loading: false}))
  }
}

const _createPersonalRepo = (action: GitGen.CreatePersonalRepoPayload) =>
  Saga.call(
    _createDeleteHelper,
    Saga.call(RPCTypes.gitCreatePersonalRepoRpcPromise, {
      repoName: action.payload.name,
    })
  )

const _createTeamRepo = (action: GitGen.CreateTeamRepoPayload) =>
  Saga.call(
    _createDeleteHelper,
    Saga.call(RPCTypes.gitCreateTeamRepoRpcPromise, {
      notifyTeam: action.payload.notifyTeam,
      repoName: action.payload.name,
      teamName: {
        parts: action.payload.teamname.split('.'),
      },
    })
  )

const _deletePersonalRepo = (action: GitGen.DeletePersonalRepoPayload) =>
  Saga.call(
    _createDeleteHelper,
    Saga.call(RPCTypes.gitDeletePersonalRepoRpcPromise, {
      repoName: action.payload.name,
    })
  )

const _deleteTeamRepo = (action: GitGen.DeleteTeamRepoPayload) =>
  Saga.call(
    _createDeleteHelper,
    Saga.call(RPCTypes.gitDeleteTeamRepoRpcPromise, {
      notifyTeam: action.payload.notifyTeam,
      repoName: action.payload.name,
      teamName: {
        parts: action.payload.teamname.split('.'),
      },
    })
  )

const _setLoading = (action: GitGen.SetLoadingPayload) =>
  Saga.put(Entities.replaceEntity(['git'], I.Map([['loading', action.payload.loading]])))

const _setError = (action: GitGen.SetErrorPayload) =>
  Saga.put(Entities.replaceEntity(['git'], I.Map([['error', action.payload.error]])))

const _badgeAppForGit = (action: GitGen.BadgeAppForGitPayload) =>
  Saga.put(Entities.replaceEntity(['git'], I.Map([['isNew', I.Set(action.payload.ids)]])))

let _wasOnGitTab = false
const _onTabChange = (action: RouteTreeTypes.SwitchTo) => {
  // on the git tab?
  const list = I.List(action.payload.path)
  const root = list.first()

  if (root === Tabs.gitTab) {
    _wasOnGitTab = true
  } else if (_wasOnGitTab) {
    _wasOnGitTab = false
    // clear badges
    return Saga.call(RPCTypes.gregorDismissCategoryRpcPromise, {
      category: 'new_git_repo',
    })
  }

  return null
}

function _handleIncomingGregor(action: GitGen.HandleIncomingGregorPayload) {
  const msgs = action.payload.messages.map(msg => JSON.parse(msg.body.toString()))
  for (let body of msgs) {
    const needsLoad = ['delete', 'create', 'update'].includes(body.action)
    if (needsLoad) {
      return Saga.put(GitGen.createLoadGit())
    }
  }
}

function* gitSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(GitGen.loadGit, _loadGit)
  yield Saga.safeTakeEveryPure(GitGen.createPersonalRepo, _createPersonalRepo)
  yield Saga.safeTakeEveryPure(GitGen.createTeamRepo, _createTeamRepo)
  yield Saga.safeTakeEveryPure(GitGen.deletePersonalRepo, _deletePersonalRepo)
  yield Saga.safeTakeEveryPure(GitGen.deleteTeamRepo, _deleteTeamRepo)
  yield Saga.safeTakeLatestPure(GitGen.setLoading, _setLoading)
  yield Saga.safeTakeLatestPure(GitGen.setError, _setError)
  yield Saga.safeTakeEveryPure(GitGen.badgeAppForGit, _badgeAppForGit)
  yield Saga.safeTakeEveryPure(GitGen.handleIncomingGregor, _handleIncomingGregor)
  yield Saga.safeTakeEveryPure(RouteTreeConstants.switchTo, _onTabChange)
}

export default gitSaga
