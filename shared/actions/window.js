// @flow
import * as Constants from '../constants/window'
import {safeTakeEvery} from '../util/saga'
import {put, select} from 'redux-saga/effects'

import {selectConversation} from '../actions/chat'
import type {ChangedFocus} from '../constants/window'
import type {SagaGenerator} from '../constants/types/saga'

export function changedFocus (focus: boolean): ChangedFocus {
  return {type: Constants.changedFocus, payload: focus}
}

function * _changedFocusSaga (action: ChangedFocus): SagaGenerator<any, any> {
  const focused = action.payload
  // Reselect the current Chat conversation, to give badging a chance to
  // update based on the focus change.
  const selectedSelector = (state: TypedState) => state.chat.get('selectedConversation')
  const conversationIDKey = yield select(selectedSelector)
  if (conversationIDKey && focused) {
    yield put(selectConversation(conversationIDKey, false))
  }
}

function * windowSaga (): SagaGenerator<any, any> {
  yield [
    safeTakeEvery(Constants.changedFocus, _changedFocusSaga),
  ]
}

export default windowSaga
