// @flow
import * as Constants from '../../constants/git'
import * as Creators from '../../actions/git/creators'
import * as Entities from '../entities'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Tabs from '../../constants/tabs'
import * as RouteTreeConstants from '../../constants/route-tree'
import {globalError} from '../../constants/config'
import {call, put} from 'redux-saga/effects'
import {navigateTo} from '../route-tree'
import moment from 'moment'
import {isMobile} from '../../constants/platform'
import * as SettingsConstants from '../../constants/settings'

import type {SagaGenerator} from '../../constants/types/saga'

function* _loadGit(action: Constants.LoadGit): SagaGenerator<any, any> {
  yield put(Creators.setError(null))
  yield put(Creators.setLoading(true))

  try {
    const results: Array<RPCTypes.GitRepoResult> = yield call(RPCTypes.gitGetAllGitMetadataRpcPromise, {
      param: {},
    }) || []

    let idToInfo = {}

    for (let i = 0; i < results.length; i++) {
      const repoResult = results[i]
      if (repoResult.state === RPCTypes.GitGitRepoResultState.ok && repoResult.ok) {
        const r: RPCTypes.GitRepoInfo = repoResult.ok
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
        yield put({
          payload: new Error(`Git repo error: ${errStr}`),
          type: globalError,
        })
      }
    }

    yield put(Entities.replaceEntity(['git'], I.Map({idToInfo: I.Map(idToInfo)})))
  } finally {
    yield put(Creators.setLoading(false))
  }
}

// reset errors and set loading, make a call and either go back to the root or show an error
function* _createDeleteHelper(theCall: *) {
  yield put.resolve(Creators.setError(null))
  yield put.resolve(Creators.setLoading(true))
  try {
    yield theCall
    yield put(navigateTo(isMobile ? [Tabs.settingsTab, SettingsConstants.gitTab] : [Tabs.gitTab], []))
    yield put.resolve(Creators.setLoading(false))
    yield put(Creators.loadGit())
  } catch (err) {
    yield put(Creators.setError(err))
    yield put.resolve(Creators.setLoading(false))
  } finally {
    // just in case
    yield put.resolve(Creators.setLoading(false))
  }
}

function* _createPersonalRepo(action: Constants.CreatePersonalRepo): SagaGenerator<any, any> {
  yield call(
    _createDeleteHelper,
    call(RPCTypes.gitCreatePersonalRepoRpcPromise, {
      param: {
        repoName: action.payload.name,
      },
    })
  )
}

function* _createTeamRepo(action: Constants.CreateTeamRepo): SagaGenerator<any, any> {
  yield call(
    _createDeleteHelper,
    call(RPCTypes.gitCreateTeamRepoRpcPromise, {
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

function* _deletePersonalRepo(action: Constants.DeletePersonalRepo): SagaGenerator<any, any> {
  yield call(
    _createDeleteHelper,
    call(RPCTypes.gitDeletePersonalRepoRpcPromise, {
      param: {
        repoName: action.payload.name,
      },
    })
  )
}

function* _deleteTeamRepo(action: Constants.DeleteTeamRepo): SagaGenerator<any, any> {
  yield call(
    _createDeleteHelper,
    call(RPCTypes.gitDeleteTeamRepoRpcPromise, {
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

function* _setLoading(action: Constants.SetLoading): SagaGenerator<any, any> {
  yield put(Entities.replaceEntity(['git'], I.Map([['loading', action.payload.loading]])))
}

function* _setError(action: Constants.SetError): SagaGenerator<any, any> {
  yield put(Entities.replaceEntity(['git'], I.Map([['error', action.payload.gitError]])))
}

const _badgeAppForGit = (action: Constants.BadgeAppForGit) =>
  put(Entities.replaceEntity(['git'], I.Map([['isNew', I.Set(action.payload.ids)]])))

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
    return call(RPCTypes.gregorDismissCategoryRpcPromise, {
      param: {
        category: 'new_git_repo',
      },
    })
  }

  return null
}

function* gitSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('git:loadGit', _loadGit)
  yield Saga.safeTakeEvery('git:createPersonalRepo', _createPersonalRepo)
  yield Saga.safeTakeEvery('git:createTeamRepo', _createTeamRepo)
  yield Saga.safeTakeEvery('git:deletePersonalRepo', _deletePersonalRepo)
  yield Saga.safeTakeEvery('git:deleteTeamRepo', _deleteTeamRepo)
  yield Saga.safeTakeLatest('git:setLoading', _setLoading)
  yield Saga.safeTakeLatest('git:setError', _setError)
  yield Saga.safeTakeEveryPure('git:badgeAppForGit', _badgeAppForGit)
  yield Saga.safeTakeEveryPure(RouteTreeConstants.switchTo, _onTabChange)
}

export default gitSaga
