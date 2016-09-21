// @flow
import * as Constants from '../../constants/kbfs'
import {fsListRpcPromise} from '../../constants/types/flow-types'
import {openSaga} from './index.platform'
import {call, put} from 'redux-saga/effects'
import {takeLatest, takeEvery} from 'redux-saga'

import type {ListResult} from '../../constants/types/flow-types'
import type {FSList, FSListed, FSOpen} from '../../constants/kbfs'
import type {SagaGenerator} from '../../constants/types/saga'

function fsList (path: string) : FSList {
  return {type: Constants.fsList, payload: {path}}
}

function openInKBFS (path: string = ''): FSOpen {
  return {type: Constants.fsOpen, payload: {path}}
}

function * _listSaga (action: FSList): SagaGenerator<any, any> {
  try {
    const result: ?ListResult = yield call(fsListRpcPromise, {param: {path: action.payload.path}})

    if (result) {
      console.log('fs.List: ', result)
      const listAction: FSListed = {type: Constants.fsListed, payload: result}
      yield put(listAction)
    }
  } catch (error) {
    const listAction: FSListed = {type: Constants.fsListed, payload: error, error: true}
    yield put(listAction)
  }
}

function * kbfsSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.fsList, _listSaga),
    takeEvery(Constants.fsOpen, openSaga),
  ]
}

export default kbfsSaga
export {
  fsList,
  openInKBFS,
}
