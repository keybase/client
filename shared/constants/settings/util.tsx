import type * as EngineGen from '@/actions/engine-gen-gen'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
    case EngineGen.keybase1NotifyUsersPasswordChanged:
    case EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged:
    case EngineGen.keybase1NotifyEmailAddressEmailsChanged:
      const {useState} = require('./index')
      useState.getState().dispatch.onEngineIncoming(action)
      break
    default:
  }
}

