// @flow
import * as Constants from '../../constants/git'
import * as Creators from '../../actions/git/creators'
import * as Entities from '../entities'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import {call, put, select} from 'redux-saga/effects'
import {gitTab} from '../../constants/tabs'
import {navigateTo} from '../route-tree'
import moment from 'moment'

import type {SagaGenerator} from '../../constants/types/saga'

function* _loadGit(action: Constants.LoadGit): SagaGenerator<any, any> {
  yield put(Creators.setError(null))
  const alreadyLoading = yield select(s => s.entities.getIn(['git', 'loading'], false))
  if (alreadyLoading) {
    console.log('Skipping git load as we have one in progress')
    return
  }
  yield put(Creators.setLoading(true))

  const results: ?Array<RPCTypes.GitRepoResult> = yield call(RPCTypes.gitGetAllGitMetadataRpcPromise, {
    param: {},
  })

  const idToInfo = (results || []).reduce((map, r) => {
    const teamname = r.folder.folderType === RPCTypes.FavoriteFolderType.team ? r.folder.name : null
    map[r.globalUniqueID] = Constants.GitInfo({
      devicename: r.serverMetadata.lastModifyingDeviceName,
      id: r.globalUniqueID,
      isNew: false, // TODO
      lastEditTime: moment(r.serverMetadata.mtime).fromNow(),
      lastEditUser: r.serverMetadata.lastModifyingUsername,
      name: r.localMetadata.repoName,
      repoID: r.repoID,
      teamname,
      url: r.repoUrl,
    })
    return map
  }, {})

  yield put(Entities.replaceEntity(['git', 'idToInfo'], I.Map(idToInfo)))
  yield put(Creators.setLoading(false))
}

// reset errors and set loading, make a call and either go back to the root or show an error
function* _createDeleteHelper(theCall: *) {
  yield put(Creators.setError(null))
  yield put(Creators.setLoading(true))
  try {
    yield theCall
    yield put(Creators.loadGit())
    yield put(navigateTo([gitTab], []))
  } catch (err) {
    yield put(Creators.setError(err))
  } finally {
    yield put(Creators.setLoading(false))
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

function* gitSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('git:loadGit', _loadGit)
  yield Saga.safeTakeEvery('git:createPersonalRepo', _createPersonalRepo)
  yield Saga.safeTakeEvery('git:createTeamRepo', _createTeamRepo)
  yield Saga.safeTakeEvery('git:deletePersonalRepo', _deletePersonalRepo)
  yield Saga.safeTakeEvery('git:deleteTeamRepo', _deleteTeamRepo)
  yield Saga.safeTakeLatest('git:setLoading', _setLoading)
  yield Saga.safeTakeLatest('git:setError', _setError)
}

export default gitSaga
