import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyBadgesBadgeState:
      {
        const {useState} = require('./index') as typeof Index
        useState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}

export const enterPipelineWaitingKey = 'autoreset:EnterPipelineWaitingKey'
export const actuallyResetWaitingKey = 'autoreset:ActuallyResetWaitingKey'
export const cancelResetWaitingKey = 'autoreset:cancelWaitingKey'
