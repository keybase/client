// @flow
import * as Constants from '../../constants/kbfs'
import {call, put} from 'redux-saga/effects'
import {fsListRpcPromise} from '../../constants/types/flow-types'
import {
  fuseStatusSaga,
  fuseStatusUpdateSaga,
  installFuseSaga,
  installDokanSaga,
  installKBFSSaga,
  openSaga,
  openInFileUISaga,
  uninstallKBFSSaga,
} from './index.platform'
import {safeTakeLatest, safeTakeEvery} from '../../util/saga'

import type {
  FSClearFuseInstall,
  FSFuseStatus,
  FSInstallFuse,
  FSInstallKBFS,
  FSList,
  FSListed,
  FSOpen,
  FSUninstallKBFS,
} from '../../constants/kbfs'
import type {ListResult} from '../../constants/types/flow-types'
import type {SagaGenerator} from '../../constants/types/saga'
import {isWindows} from '../../constants/platform'

function fsList(path: string): FSList {
  return {payload: {path}, type: Constants.fsList}
}

function openInKBFS(path: string = ''): FSOpen {
  return {payload: {path}, type: Constants.fsOpen}
}

function* _listSaga(action: FSList): SagaGenerator<any, any> {
  try {
    const result: ?ListResult = yield call(fsListRpcPromise, {param: {path: action.payload.path}})

    if (result) {
      console.log('fs.List: ', result)
      const listAction: FSListed = {payload: result, type: Constants.fsListed}
      yield put(listAction)
    }
  } catch (error) {
    const listAction: FSListed = {error: true, payload: error, type: Constants.fsListed}
    yield put(listAction)
  }
}

function fuseStatus(): FSFuseStatus {
  return {payload: undefined, type: 'fs:fuseStatus'}
}

function installFuse(): FSInstallFuse {
  return {payload: undefined, type: 'fs:installFuse'}
}

function installKBFS(): FSInstallKBFS {
  return {payload: undefined, type: 'fs:installKBFS'}
}

function uninstallKBFS(): FSUninstallKBFS {
  return {payload: undefined, type: 'fs:uninstallKBFS'}
}

function clearFuseInstall(): FSClearFuseInstall {
  return {payload: undefined, type: 'fs:clearFuseInstall'}
}

function* kbfsSaga(): SagaGenerator<any, any> {
  yield safeTakeLatest(Constants.fsList, _listSaga)
  yield safeTakeEvery(Constants.fsOpen, openSaga)
  yield safeTakeEvery('fs:openInFileUI', openInFileUISaga)
  yield safeTakeLatest('fs:fuseStatus', fuseStatusSaga)
  yield safeTakeLatest('fs:fuseStatusUpdate', fuseStatusUpdateSaga)
  if (isWindows) {
    yield safeTakeLatest('fs:installFuse', installDokanSaga)
  } else {
    yield safeTakeLatest('fs:installFuse', installFuseSaga)
  }
  yield safeTakeLatest('fs:installKBFS', installKBFSSaga)
  yield safeTakeLatest('fs:uninstallKBFS', uninstallKBFSSaga)
}

export default kbfsSaga
export {clearFuseInstall, fsList, fuseStatus, installFuse, installKBFS, openInKBFS, uninstallKBFS}
