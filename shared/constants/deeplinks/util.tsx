import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyServiceHandleKeybaseLink:
      {
        storeRegistry.getState('deeplinks').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
