import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
      {
        const {useSignupState} = require('.') as typeof Index
        useSignupState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
