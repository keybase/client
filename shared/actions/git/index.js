// @flow
import * as Constants from '../../constants/git'
import * as Creators from '../../actions/git/creators'
import * as Entities from '../entities'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Selectors from '../../constants/selectors'
import {call, put, select} from 'redux-saga/effects'
import moment from 'moment'

import type {SagaGenerator} from '../../constants/types/saga'

function* _loadGit(action: Constants.LoadGit): SagaGenerator<any, any> {
  yield put(Creators.setLoading(true))
  const you = yield select(Selectors.usernameSelector)

  const results: ?Array<RPCTypes.GitRepoResult> = yield call(RPCTypes.gitGetAllGitMetadataRpcPromise, {
    param: {},
  })

  const idToInfo = (results || []).reduce((map, r) => {
    const teamname = r.folder.folderType === RPCTypes.FavoriteFolderType.team ? r.folder.name : null
    map[r.repoID] = Constants.GitInfo({
      devicename: `DeviceID:${r.serverMetadata.lastModifyingDeviceID}`, // TDOO
      id: r.repoID,
      isNew: false, // TODO
      lastEditTime: moment(r.serverMetadata.mtime).fromNow(),
      lastEditUser: r.serverMetadata.lastModifyingUsername,
      name: r.localMetadata.repoName,
      teamname,
      url: `keybase://${teamname ? `team/${teamname}` : `private/${you}`}/${r.localMetadata.repoName}.git`, // TODO
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
      // TODO notify flag
    },
  })
  yield put(Creators.loadGit())
}

function* _deleteRepo(action: Constants.DeleteRepo): SagaGenerator<any, any> {
  // yield call(RPCTypes.gitDeleteRepoRpcPromise, {
  // param: {
  // repoName: action.payload.name,
  // teamName: {
  // parts: action.payload.teamname.split('.'),
  // },
  // // TODO notify flag
  // },
  // })
  console.warn('not implemented yet')
  yield put(Creators.loadGit())
}

function* _setLoading(action: Constants.SetLoading): SagaGenerator<any, any> {
  yield put(Entities.replaceEntity(['git'], I.Map([['loading', action.payload.loading]])))
}

function* gitSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('git:loadGit', _loadGit)
  yield Saga.safeTakeEvery('git:createPersonalRepo', _createPersonalRepo)
  yield Saga.safeTakeEvery('git:createTeamRepo', _createTeamRepo)
  yield Saga.safeTakeEvery('git:deleteRepo', _deleteRepo)
  yield Saga.safeTakeLatest('git:setLoading', _setLoading)
}

export default gitSaga
