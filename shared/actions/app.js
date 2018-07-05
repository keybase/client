// @flow
import logger from '../logger'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as AppGen from './app-gen'
import {quit} from '../util/quit-helper'
import dumpLogs from '../logger/dump-log-fs'

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

  return Saga.put(AppGen.createChangedFocus({appFocused}))
}

function _dumpLogs(action: AppGen.DumpLogsPayload) {
  dumpLogs().then(() => {
    // quit as soon as possible
    if (action.payload.reason === 'quitting through menu') {
      quit('quitButton')
    }
  })
}

function* appStateSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(AppGen.mobileAppState, _onMobileAppStateChanged)
  yield Saga.safeTakeEveryPure(AppGen.dumpLogs, _dumpLogs)
}

export default appStateSaga
