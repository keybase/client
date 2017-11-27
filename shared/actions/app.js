// @flow
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import * as AppGen from './app-gen'
import {call, put} from 'redux-saga/effects'

function* _onMobileAppStateChanged(action: AppGen.MobileAppStatePayload): Saga.SagaGenerator<any, any> {
  const nextAppState = action.payload.nextAppState

  const appFocused = {
    active: true,
    inactive: false,
    background: false,
  }[nextAppState]

  yield put(AppGen.createChangedFocus({appFocused}))

  const state =
    {
      active: RPCTypes.appStateAppState.foreground,
      inactive: RPCTypes.appStateAppState.inactive,
      background: RPCTypes.appStateAppState.background,
    }[nextAppState] || RPCTypes.appStateAppState.foreground
  console.log(`setting app state on service to: ${state}`)

  yield call(RPCTypes.appStateUpdateAppStateRpcPromise, {state})
}

function* appStateSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(AppGen.mobileAppState, _onMobileAppStateChanged)
}

export default appStateSaga
