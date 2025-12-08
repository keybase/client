import * as T from '../types'
import * as C from '..'
import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'
import logger from '@/logger'

export const onEngineConnected = () => {
  const f = async () => {
    try {
      await T.RPCGen.delegateUiCtlRegisterIdentify3UIRpcPromise()
      logger.info('Registered identify ui')
    } catch (error) {
      logger.warn('error in registering identify ui: ', error)
    }
  }
  C.ignorePromise(f())
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyTrackingTrackingChanged:
    case EngineGen.keybase1Identify3UiIdentify3Result:
    case EngineGen.keybase1Identify3UiIdentify3ShowTracker:
    case EngineGen.keybase1NotifyUsersUserChanged:
    case EngineGen.keybase1NotifyTrackingNotifyUserBlocked:
    case EngineGen.keybase1Identify3UiIdentify3UpdateRow:
    case EngineGen.keybase1Identify3UiIdentify3UserReset:
    case EngineGen.keybase1Identify3UiIdentify3UpdateUserCard:
    case EngineGen.keybase1Identify3UiIdentify3Summary:
      {
        const {useTrackerState} = require('.') as typeof Index
        useTrackerState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
