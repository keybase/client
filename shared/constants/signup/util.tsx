import type * as EngineGen from '@/actions/engine-gen-gen'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
      const {useState_} = require('./index')
      useState_.getState().dispatch.onEngineIncoming(action)
      break
    default:
  }
}

