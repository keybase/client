import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
      {
        storeRegistry.getState('signup').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
