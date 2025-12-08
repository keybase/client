import * as EngineGen from '@/actions/engine-gen-gen'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyBadgesBadgeState:
      {
        const {useState} = require('./index')
        useState.getState().dispatch.onEngineIncoming(action)
      }
      break
    default:
  }
}
