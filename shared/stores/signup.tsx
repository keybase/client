import * as S from '@/constants/strings'
import type * as EngineGen from '@/constants/rpc'
import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'

type Store = T.Immutable<{
  devicename: string
  justSignedUpEmail: string
}>

const initialStore: Store = {
  devicename: S.defaultDevicename,
  justSignedUpEmail: '',
}

export type State = Store & {
  dispatch: {
    defer: {
      onEditEmail?: (p: {email: string; makeSearchable: boolean}) => void
      onShowPermissionsPrompt?: (p: {justSignedUp?: boolean}) => void
    }
    clearJustSignedUpEmail: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: () => void
    setDevicename: (devicename: string) => void
    setJustSignedUpEmail: (email: string) => void
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
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
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
  }
  return {
    ...initialStore,
    dispatch,
  }
})
