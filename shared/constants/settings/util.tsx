import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
    case EngineGen.keybase1NotifyUsersPasswordChanged:
    case EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged:
    case EngineGen.keybase1NotifyEmailAddressEmailsChanged:
      {
        storeRegistry.getState('settings').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
