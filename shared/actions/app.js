// @flow
import logger from '../logger'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import * as AppGen from './app-gen'
import {showMainWindow} from './platform-specific'

function _onMobileAppStateChanged(action: AppGen.MobileAppStatePayload) {
  const nextAppState = action.payload.nextAppState

  const appFocused = {
    active: true,
    background: false,
    inactive: false,
  }[nextAppState]

  const state =
    {
      active: RPCTypes.appStateAppState.foreground,
      background: RPCTypes.appStateAppState.background,
      inactive: RPCTypes.appStateAppState.inactive,
    }[nextAppState] || RPCTypes.appStateAppState.foreground
  logger.info(`setting app state on service to: ${state}`)

  return Saga.sequentially([
    Saga.put(AppGen.createChangedFocus({appFocused})),
    Saga.call(RPCTypes.appStateUpdateAppStateRpcPromise, {state}),
  ])
}

function _onShowMain() {
  showMainWindow()
}

function* appStateSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatestPure(AppGen.showMain, _onShowMain)
  yield Saga.safeTakeLatestPure(AppGen.mobileAppState, _onMobileAppStateChanged)
}

export default appStateSaga
