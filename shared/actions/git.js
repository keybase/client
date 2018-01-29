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

// TODO refactor into pure function & reuse _processGitRepo
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
        idToInfo[r.repoID] = Constants.makeGitInfo({
          canDelete: r.canDelete,
          devicename: r.serverMetadata.lastModifyingDeviceName,
          id: r.globalUniqueID,
          lastEditTime: moment(r.serverMetadata.mtime).fromNow(),
          lastEditUser: r.serverMetadata.lastModifyingUsername,
          name: r.localMetadata.repoName,
          teamname,
          repoID: r.repoID,
          url: r.repoUrl,
          channelName: (r.teamRepoSettings && r.teamRepoSettings.channelName) || null,
          chatDisabled: !!r.teamRepoSettings && r.teamRepoSettings.chatDisabled,
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

const _setTeamRepoSettings = (action: GitGen.SetTeamRepoSettingsPayload) =>
  Saga.sequentially([
    Saga.call(RPCTypes.gitSetTeamRepoSettingsRpcPromise, {
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
    }),
    Saga.put(GitGen.createLoadGitRepo({teamname: action.payload.teamname, username: null})),
  ])

const _loadGitRepo = (action: GitGen.LoadGitRepoPayload) =>
  Saga.call(RPCTypes.gitGetGitMetadataRpcPromise, {
    folder: {
      name: action.payload.teamname || action.payload.username || '',
      folderType: action.payload.teamname
        ? RPCTypes.favoriteFolderType.team
        : RPCTypes.favoriteFolderType.private,
      private: true,
      created: false,
      notificationsOn: false,
    },
  })

// TODO refactor along with _loadGit to reuse this function
const _processGitRepo = (results: Array<RPCTypes.GitRepoResult>) => {
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
        repoID: r.repoID,
        url: r.repoUrl,
        channelName: (r.teamRepoSettings && r.teamRepoSettings.channelName) || null,
        chatDisabled: !!r.teamRepoSettings && r.teamRepoSettings.chatDisabled,
      })
    } else {
      let errStr: string = 'unknown'
      if (repoResult.state === RPCTypes.gitGitRepoResultState.err && repoResult.err) {
        errStr = repoResult.err
      }
      return Saga.put(
        ConfigGen.createGlobalError({
          globalError: new Error(`Git repo error: ${errStr}`),
        })
      )
    }
  }

  return Saga.put(Entities.mergeEntity(['git'], I.Map({idToInfo: I.Map(idToInfo)})))
}

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
  yield Saga.safeTakeEveryPure(GitGen.setTeamRepoSettings, _setTeamRepoSettings)
  yield Saga.safeTakeEveryPure(GitGen.loadGitRepo, _loadGitRepo, _processGitRepo)
}

export default gitSaga
