import * as EngineGen from '@/actions/engine-gen-gen'
import {useSignupState} from '.'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
      {
        useSignupState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
