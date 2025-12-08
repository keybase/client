import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged:
    case EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath:
    case EngineGen.keybase1NotifyFSFSSubscriptionNotify:
      {
        const {useFSState} = require('./index') as typeof Index
        useFSState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
