// @flow
import * as Constants from '../constants/app'
import * as Types from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import {call, put} from 'redux-saga/effects'

import type {SagaGenerator} from '../constants/types/saga'

function changedFocus(appFocused: boolean): Constants.ChangedFocus {
  return {payload: {appFocused}, type: 'app:changedFocus'}
}

function appLink(link: string): Constants.AppLink {
  return {payload: {link}, type: 'app:link'}
}

function mobileAppStateChanged(nextAppState: string): Constants.MobileAppState {
  return {payload: {nextAppState}, type: 'app:mobileAppState'}
}

const _onMobileAppStateChanged = function*(action: Constants.MobileAppState): SagaGenerator<any, any> {
  const nextAppState = action.payload.nextAppState

  const focusState = {
    active: true,
    inactive: false,
    background: false,
  }[nextAppState]

  yield put(changedFocus(focusState))

  const state: Types.AppState =
    {
      active: Types.AppStateAppState.foreground,
      inactive: Types.AppStateAppState.inactive,
      background: Types.AppStateAppState.background,
    }[nextAppState] || Types.AppStateAppState.foreground

  yield call(Types.appStateUpdateAppStateRpcPromise, {param: {state}})
}

const appStateSaga = function*(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('app:mobileAppState', _onMobileAppStateChanged)
}

export {appLink, changedFocus, mobileAppStateChanged, appStateSaga}

export default appStateSaga
