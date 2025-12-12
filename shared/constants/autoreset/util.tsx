import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyBadgesBadgeState:
      {
        storeRegistry.getState('autoreset').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
