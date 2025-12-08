import * as EngineGen from '@/actions/engine-gen-gen'
import * as Platforms from '../platform'
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

export const maxUsernameLength = 16
export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'
export const noEmail = 'NOEMAIL'
export const waitingKey = 'signup:waiting'

export const defaultDevicename =
  (Platforms.isAndroid ? 'Android Device' : undefined) ||
  (Platforms.isIOS ? 'iOS Device' : undefined) ||
  (Platforms.isDarwin ? 'Mac Device' : undefined) ||
  (Platforms.isWindows ? 'Windows Device' : undefined) ||
  (Platforms.isLinux ? 'Linux Device' : undefined) ||
  (Platforms.isMobile ? 'Mobile Device' : 'Home Computer')
