// @flow

import * as Constants from '../constants/gregor'
import {call, put, select} from 'redux-saga/effects'
import {takeEvery} from 'redux-saga'
import {favoriteList} from './favorite'
import engine from '../engine'
import {delegateUiCtlRegisterGregorFirehoseRpc} from '../constants/types/flow-types'

import type {PushState, UpdateSeenMsgs, MsgMap, NonNullGregorItem} from '../constants/gregor'
import type {Dispatch} from '../constants/types/flux'
import type {PushReason} from '../constants/types/flow-types'
import type {State as GregorState, ItemAndMetadata as GregorItem} from '../constants/types/flow-types-gregor'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

function pushState (state: GregorState, reason: PushReason): PushState {
  return {type: Constants.pushState, payload: {state, reason}}
}

function updateSeenMsgs (seenMsgs: Array<NonNullGregorItem>): UpdateSeenMsgs {
  return {type: Constants.updateSeenMsgs, payload: {seenMsgs}}
}

function isNonNullGregorItem (gItem: GregorItem): boolean {
  return !!(gItem && gItem.item && gItem.md)
}

function isTlfItem (gItem: GregorItem): boolean {
  return !!(gItem && gItem.item && gItem.item.category && gItem.item.category === 'tlf')
}

function toNonNullGregorItems (state: GregorState): Array<NonNullGregorItem> {
  // $ForceType
  return (state.items || []).filter(isNonNullGregorItem)
}

function registerGregorListeners () {
  return (dispatch: Dispatch) => {
    delegateUiCtlRegisterGregorFirehoseRpc({
      callback: (error, response) => {
        if (error != null) {
          console.warn('error in registering gregor listener: ', error)
        } else {
          console.log('Registered gregor listener')
        }
      },
    })

    // we get this with sessionID == 0 if we call openDialog
    engine.setIncomingHandler('keybase.1.gregorUI.pushState', ({state, reason}, response) => {
      dispatch(pushState(state, reason))
      response && response.result()
    })
  }
}

function * handleTLFUpdate (items: Array<NonNullGregorItem>): SagaGenerator<any, any> {
  // $ForceType
  const seenMsgs: MsgMap = yield select((state: TypedState) => state.gregor.seenMsgs)

  // Check if any are a tlf items
  const tlfUpdates = items.filter(isTlfItem)
  const newTlfUpdates = tlfUpdates.filter(gItem => !seenMsgs[gItem.md.msgID.toString('base64')])
  if (newTlfUpdates.length) {
    yield put(updateSeenMsgs(newTlfUpdates))
    yield put(favoriteList())
  }
}

function * handlePushState (pushAction: PushState): SagaGenerator<any, any> {
  if (!pushAction.error) {
    const {payload: {state}} = pushAction
    const nonNullItems = toNonNullGregorItems(state)
    if (nonNullItems.length !== (state.items || []).length) {
      console.warn('Lost some messages in filtering out nonNull gregor items')
    }

    yield [
      call(handleTLFUpdate, nonNullItems),
    ]
  } else {
    console.log('Error in gregor pushState', pushAction.payload)
  }
}

function * gregorSaga (): SagaGenerator<any, any> {
  yield takeEvery(Constants.pushState, handlePushState)
}

export {
  pushState,
  registerGregorListeners,
}

export default gregorSaga
