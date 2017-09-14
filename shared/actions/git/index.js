// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/git'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Entities from '../entities'
import * as Selectors from '../../constants/selectors'
import {call, put, all, take, select, race} from 'redux-saga/effects'
import moment from 'moment'

import type {SagaGenerator} from '../../constants/types/saga'

function* _loadGit(action: Constants.LoadGit): SagaGenerator<any, any> {
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
}

function* gitSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('git:loadGit', _loadGit)
}

export default gitSaga
