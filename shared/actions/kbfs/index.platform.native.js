// @flow
import {favoriteFolder} from '../favorite'
import {put} from 'redux-saga/effects'

import type {FSOpen, OpenInFileUI} from '../../constants/kbfs'
import type {SagaGenerator} from '../../constants/types/saga'

function* openSaga(action: FSOpen): SagaGenerator<any, any> {
  const openPath = action.payload.path
  yield put(favoriteFolder(openPath))
}

function* openInFileUISaga(action: OpenInFileUI): SagaGenerator<any, any> {}

export {openInFileUISaga, openSaga}
