import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyUsersIdentifyUpdate:
    case EngineGen.keybase1NotifyTrackingNotifyUserBlocked:
      {
        storeRegistry.getState('users').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
