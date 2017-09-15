// @flow
import * as Constants from '../../constants/git'
import * as Creators from '../../actions/git/creators'
import * as Entities from '../entities'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import {call, put, select} from 'redux-saga/effects'
import moment from 'moment'

import type {SagaGenerator} from '../../constants/types/saga'

function* _loadGit(action: Constants.LoadGit): SagaGenerator<any, any> {
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

function* _createPersonalRepo(action: Constants.CreatePersonalRepo): SagaGenerator<any, any> {
  yield call(RPCTypes.gitCreatePersonalRepoRpcPromise, {
    param: {
      repoName: action.payload.name,
    },
  })
  yield put(Creators.loadGit())
}

function* _createTeamRepo(action: Constants.CreateTeamRepo): SagaGenerator<any, any> {
  yield call(RPCTypes.gitCreateTeamRepoRpcPromise, {
    param: {
      repoName: action.payload.name,
      teamName: {
        parts: action.payload.teamname.split('.'),
      },
      notifyTeam: action.payload.notifyTeam,
    },
  })
  yield put(Creators.loadGit())
}

function* _deletePersonalRepo(action: Constants.DeletePersonalRepo): SagaGenerator<any, any> {
  yield call(RPCTypes.gitDeletePersonalRepoRpcPromise, {
    param: {
      repoName: action.payload.name,
    },
  })
  yield put(Creators.loadGit())
}

function* _deleteTeamRepo(action: Constants.DeleteTeamRepo): SagaGenerator<any, any> {
  yield call(RPCTypes.gitDeleteTeamRepoRpcPromise, {
    param: {
      repoName: action.payload.name,
      teamName: {
        parts: action.payload.teamname.split('.'),
      },
      notifyTeam: action.payload.notifyTeam,
    },
  })
  yield put(Creators.loadGit())
}

function* _setLoading(action: Constants.SetLoading): SagaGenerator<any, any> {
  yield put(Entities.replaceEntity(['git'], I.Map([['loading', action.payload.loading]])))
}

function* gitSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('git:loadGit', _loadGit)
  yield Saga.safeTakeEvery('git:createPersonalRepo', _createPersonalRepo)
  yield Saga.safeTakeEvery('git:createTeamRepo', _createTeamRepo)
  yield Saga.safeTakeEvery('git:deletePersonalRepo', _deletePersonalRepo)
  yield Saga.safeTakeEvery('git:deleteTeamRepo', _deleteTeamRepo)
  yield Saga.safeTakeLatest('git:setLoading', _setLoading)
}

export default gitSaga
