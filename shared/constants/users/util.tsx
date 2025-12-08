import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyUsersIdentifyUpdate:
    case EngineGen.keybase1NotifyTrackingNotifyUserBlocked:
      {
        const {useUsersState} = require('.') as typeof Index
        useUsersState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
