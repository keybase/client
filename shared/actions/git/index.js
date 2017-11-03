// @flow
import * as ConfigGen from '../../actions/config-gen'
import * as Constants from '../../constants/git'
import * as Creators from '../../actions/git/creators'
import * as Entities from '../entities'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as RouteTreeConstants from '../../constants/route-tree'
import * as Saga from '../../util/saga'
import * as SettingsConstants from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import moment from 'moment'
import {isMobile} from '../../constants/platform'
import {navigateTo} from '../route-tree'

function* _loadGit(action: Constants.LoadGit): Saga.SagaGenerator<any, any> {
  yield Saga.put(Creators.setError(null))
  yield Saga.put(Creators.setLoading(true))

  try {
    const results: Array<RPCTypes.GitRepoResult> = yield Saga.call(RPCTypes.gitGetAllGitMetadataRpcPromise, {
      param: {},
    }) || []

    let idToInfo = {}

    for (let i = 0; i < results.length; i++) {
      const repoResult = results[i]
      if (repoResult.state === RPCTypes.GitGitRepoResultState.ok && repoResult.ok) {
        const r: RPCTypes.GitRepoInfo = repoResult.ok
        if (!r.folder.private) {
          // Skip public repos
          continue
        }
        const teamname = r.folder.folderType === RPCTypes.FavoriteFolderType.team ? r.folder.name : null
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
        if (repoResult.state === RPCTypes.GitGitRepoResultState.err && repoResult.err) {
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
    yield Saga.put(Creators.setLoading(false))
  }
}

// reset errors and set loading, make a call and either go back to the root or show an error
function* _createDeleteHelper(theCall: *) {
  yield Saga.put.resolve(Creators.setError(null))
  yield Saga.put.resolve(Creators.setLoading(true))
  try {
    yield theCall
    yield Saga.put(navigateTo(isMobile ? [Tabs.settingsTab, SettingsConstants.gitTab] : [Tabs.gitTab], []))
    yield Saga.put.resolve(Creators.setLoading(false))
    yield Saga.put(Creators.loadGit())
  } catch (err) {
    yield Saga.put(Creators.setError(err))
    yield Saga.put.resolve(Creators.setLoading(false))
  } finally {
    // just in case
    yield Saga.put.resolve(Creators.setLoading(false))
  }
}

function* _createPersonalRepo(action: Constants.CreatePersonalRepo): Saga.SagaGenerator<any, any> {
  yield Saga.call(
    _createDeleteHelper,
    Saga.call(RPCTypes.gitCreatePersonalRepoRpcPromise, {
      param: {
        repoName: action.payload.name,
      },
    })
  )
}

function* _createTeamRepo(action: Constants.CreateTeamRepo): Saga.SagaGenerator<any, any> {
  yield Saga.call(
    _createDeleteHelper,
    Saga.call(RPCTypes.gitCreateTeamRepoRpcPromise, {
      param: {
        notifyTeam: action.payload.notifyTeam,
        repoName: action.payload.name,
        teamName: {
          parts: action.payload.teamname.split('.'),
        },
      },
    })
  )
}

function* _deletePersonalRepo(action: Constants.DeletePersonalRepo): Saga.SagaGenerator<any, any> {
  yield Saga.call(
    _createDeleteHelper,
    Saga.call(RPCTypes.gitDeletePersonalRepoRpcPromise, {
      param: {
        repoName: action.payload.name,
      },
    })
  )
}

function* _deleteTeamRepo(action: Constants.DeleteTeamRepo): Saga.SagaGenerator<any, any> {
  yield Saga.call(
    _createDeleteHelper,
    Saga.call(RPCTypes.gitDeleteTeamRepoRpcPromise, {
      param: {
        notifyTeam: action.payload.notifyTeam,
        repoName: action.payload.name,
        teamName: {
          parts: action.payload.teamname.split('.'),
        },
      },
    })
  )
}

function* _setLoading(action: Constants.SetLoading): Saga.SagaGenerator<any, any> {
  yield Saga.put(Entities.replaceEntity(['git'], I.Map([['loading', action.payload.loading]])))
}

function* _setError(action: Constants.SetError): Saga.SagaGenerator<any, any> {
  yield Saga.put(Entities.replaceEntity(['git'], I.Map([['error', action.payload.gitError]])))
}

const _badgeAppForGit = (action: Constants.BadgeAppForGit) =>
  Saga.put(Entities.replaceEntity(['git'], I.Map([['isNew', I.Set(action.payload.ids)]])))

let _wasOnGitTab = false
const _onTabChange = (action: RouteTreeConstants.SwitchTo) => {
  // on the git tab?
  const list = I.List(action.payload.path)
  const root = list.first()

  if (root === Tabs.gitTab) {
    _wasOnGitTab = true
  } else if (_wasOnGitTab) {
    _wasOnGitTab = false
    // clear badges
    return Saga.call(RPCTypes.gregorDismissCategoryRpcPromise, {
      param: {
        category: 'new_git_repo',
      },
    })
  }

  return null
}

function* _handleIncomingGregor(action: Constants.HandleIncomingGregor): Saga.SagaGenerator<any, any> {
  const msgs = action.payload.messages.map(msg => JSON.parse(msg.body))
  for (let body of msgs) {
    const needsLoad = ['delete', 'create', 'update'].includes(body.action)
    if (needsLoad) {
      yield Saga.put(Creators.loadGit())
      return // Note: remove (or replace with `continue`) if any other actions may need dispatching
    }
  }
}

function* gitSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('git:loadGit', _loadGit)
  yield Saga.safeTakeEvery('git:createPersonalRepo', _createPersonalRepo)
  yield Saga.safeTakeEvery('git:createTeamRepo', _createTeamRepo)
  yield Saga.safeTakeEvery('git:deletePersonalRepo', _deletePersonalRepo)
  yield Saga.safeTakeEvery('git:deleteTeamRepo', _deleteTeamRepo)
  yield Saga.safeTakeLatest('git:setLoading', _setLoading)
  yield Saga.safeTakeLatest('git:setError', _setError)
  yield Saga.safeTakeEveryPure('git:badgeAppForGit', _badgeAppForGit)
  yield Saga.safeTakeEvery('git:handleIncomingGregor', _handleIncomingGregor)
  yield Saga.safeTakeEveryPure(RouteTreeConstants.switchTo, _onTabChange)
}

export default gitSaga
