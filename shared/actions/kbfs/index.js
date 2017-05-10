// @flow
import * as Constants from '../../constants/kbfs'
import {call, put} from 'redux-saga/effects'
import {fsListRpcPromise} from '../../constants/types/flow-types'
import {openSaga, openInFileUISaga} from './index.platform'
import {safeTakeLatest, safeTakeEvery} from '../../util/saga'

import type {FSList, FSListed, FSOpen} from '../../constants/kbfs'
import type {ListResult} from '../../constants/types/flow-types'
import type {SagaGenerator} from '../../constants/types/saga'

function fsList(path: string): FSList {
  return {payload: {path}, type: Constants.fsList}
}

function openInKBFS(path: string = ''): FSOpen {
  return {payload: {path}, type: Constants.fsOpen}
}

function* _listSaga(action: FSList): SagaGenerator<any, any> {
  try {
    const result: ?ListResult = yield call(fsListRpcPromise, {
      param: {path: action.payload.path},
    })

    if (result) {
      console.log('fs.List: ', result)
      const listAction: FSListed = {
        payload: result,
        type: Constants.fsListed,
      }
      yield put(listAction)
    }
  } catch (error) {
    const listAction: FSListed = {
      error: true,
      payload: error,
      type: Constants.fsListed,
    }
    yield put(listAction)
  }
}

function* kbfsSaga(): SagaGenerator<any, any> {
  yield safeTakeLatest(Constants.fsList, _listSaga)
  yield safeTakeEvery(Constants.fsOpen, openSaga)
  yield safeTakeEvery('fs:openInFileUI', openInFileUISaga)
}

export default kbfsSaga
export {fsList, openInKBFS}
