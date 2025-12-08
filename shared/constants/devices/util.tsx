import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyBadgesBadgeState:
      {
        const {useState} = require('./index') as typeof Index
        useState.getState().dispatch.onEngineIncoming(action)
      }
      break
    default:
  }
}
