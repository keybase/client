// @flow
import * as Constants from '../constants/app'
import * as Types from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import {call, put} from 'redux-saga/effects'

import type {SagaGenerator} from '../constants/types/saga'

function changedFocus (appFocused: boolean): Constants.ChangedFocus {
  return {payload: {appFocused}, type: 'app:changedFocus'}
}

function appLink (link: string): Constants.AppLink {
  return {payload: {link}, type: 'app:link'}
}

function hideKeyboard (): Constants.HideKeyboard {
  return {payload: undefined, type: 'app:hideKeyboard'}
}

function mobileAppStateChanged (nextAppState: string): Constants.MobileAppState {
  return {payload: {nextAppState}, type: 'app:mobileAppState'}
}

function * _onMobileAppStateChanged (action : Constants.MobileAppState): SagaGenerator<any, any> {
  let appState = Types.AppStateAppState.foreground
  const nextAppState = action.payload.nextAppState
  if (nextAppState === 'active') {
    appState = Types.AppStateAppState.foreground
    yield put(changedFocus(true))
  } else if (nextAppState === 'inactive') {
    appState = Types.AppStateAppState.inactive
    yield put(changedFocus(false))
  } else if (nextAppState === 'background') {
    appState = Types.AppStateAppState.background
    yield put(changedFocus(false))
  }

  yield call(Types.appStateUpdateAppStateRpc, {
    param: {
      state: appState,
    },
  })
}

function * appStateSaga (): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest('app:mobileAppState', _onMobileAppStateChanged)
}

export {
  appLink,
  changedFocus,
  hideKeyboard,
  mobileAppStateChanged,
  appStateSaga,
}

export default appStateSaga
