import {ignorePromise} from '@/constants/utils'
import * as S from '@/constants/strings'
import type * as EngineGen from '@/constants/rpc'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {useConfigState} from '@/stores/config'

type AutoInviteState = 'idle' | 'requesting' | 'ready'

type Store = T.Immutable<{
  autoInviteState: AutoInviteState
  devicename: string
  email: string
  inviteCode: string
  justSignedUpEmail: string
  username: string
}>

const initialStore: Store = {
  autoInviteState: 'idle',
  devicename: S.defaultDevicename,
  email: '',
  inviteCode: '',
  justSignedUpEmail: '',
  username: '',
}

export type State = Store & {
  dispatch: {
    defer: {
      onEditEmail?: (p: {email: string; makeSearchable: boolean}) => void
      onShowPermissionsPrompt?: (p: {justSignedUp?: boolean}) => void
    }
    clearJustSignedUpEmail: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    requestAutoInvite: (username?: string) => void
    resetAutoInviteState: () => void
    resetState: () => void
    setDevicename: (devicename: string) => void
    setJustSignedUpEmail: (email: string) => void
    setUsername: (username: string) => void
  }
}

export const useSignupState = Z.createZustand<State>('signup', (set, get) => {
  const dispatch: State['dispatch'] = {
    clearJustSignedUpEmail: () => {
      set(s => {
        s.justSignedUpEmail = ''
      })
    },
    defer: {
      onEditEmail: () => {
        throw new Error('onEditEmail not implemented')
      },
      onShowPermissionsPrompt: () => {
        throw new Error('onShowPermissionsPrompt not implemented')
      },
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case 'keybase.1.NotifyEmailAddress.emailAddressVerified':
          get().dispatch.clearJustSignedUpEmail()
          break
        default:
      }
    },
    requestAutoInvite: username => {
      set(s => {
        s.autoInviteState = 'requesting'
        if (username) {
          s.username = username
        }
      })
      const f = async () => {
        if (useConfigState.getState().loggedIn) {
          await T.RPCGen.loginLogoutRpcPromise({force: false, keepSecrets: true})
        }
        try {
          const inviteCode = await T.RPCGen.signupGetInvitationCodeRpcPromise(undefined, S.waitingKeySignup)
          set(s => {
            s.autoInviteState = 'ready'
            s.inviteCode = inviteCode
          })
        } catch {
          set(s => {
            s.autoInviteState = 'ready'
            s.inviteCode = ''
          })
        }
      }
      ignorePromise(f())
    },
    resetAutoInviteState: () => {
      set(s => {
        s.autoInviteState = 'idle'
      })
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        justSignedUpEmail: '',
      }))
    },
    setDevicename: (devicename: string) => {
      set(s => {
        s.devicename = devicename
      })
    },
    setJustSignedUpEmail: (email: string) => {
      set(s => {
        s.justSignedUpEmail = email
      })
    },
    setUsername: (username: string) => {
      set(s => {
        s.username = username
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
