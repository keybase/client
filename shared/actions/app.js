// @flow
import * as Constants from '../constants/app'
import * as Types from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import {call, put} from 'redux-saga/effects'

import type {SagaGenerator} from '../constants/types/saga'

function changedFocus(appFocused: boolean): Constants.ChangedFocus {
  return {payload: {appFocused}, type: 'app:changedFocus'}
}

function changedActive(userActive: boolean): Constants.ChangedActive {
  return {payload: {userActive}, type: 'app:changedActive'}
}

function appLink(link: string): Constants.AppLink {
  return {payload: {link}, type: 'app:link'}
}

function mobileAppStateChanged(nextAppState: string): Constants.MobileAppState {
  return {payload: {nextAppState}, type: 'app:mobileAppState'}
}

function* _onMobileAppStateChanged(action: Constants.MobileAppState): SagaGenerator<any, any> {
  const nextAppState = action.payload.nextAppState

  const focusState = {
    active: true,
    inactive: false,
    background: false,
  }[nextAppState]

  yield put(changedFocus(focusState))

  const state =
    {
      active: Types.AppStateAppState.foreground,
      inactive: Types.AppStateAppState.inactive,
      background: Types.AppStateAppState.background,
    }[nextAppState] || Types.AppStateAppState.foreground

  yield call(Types.appStateUpdateAppStateRpcPromise, {param: {state}})
}

function* appStateSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('app:mobileAppState', _onMobileAppStateChanged)
}

export {appLink, changedFocus, changedActive, mobileAppStateChanged, appStateSaga}

export default appStateSaga
