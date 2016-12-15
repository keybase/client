// @flow
import * as Constants from '../../constants/kbfs'
import {call, put} from 'redux-saga/effects'
import {fsListRpcPromise} from '../../constants/types/flow-types'
import {openSaga, openInFileUISaga} from './index.platform'
import {safeTakeLatest, safeTakeEvery} from '../../util/saga'

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
    safeTakeLatest(Constants.fsList, _listSaga),
    safeTakeEvery(Constants.fsOpen, openSaga),
    safeTakeEvery('fs:openInFileUI', openInFileUISaga),
  ]
}

export default kbfsSaga
export {
  fsList,
  openInKBFS,
}
