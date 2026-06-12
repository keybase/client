import * as Z from '@/util/zustand'
import type * as T from '@/constants/types'
import logger from '@/logger'

const makeEmailRow = (): EmailRow => ({
  email: '',
  isPrimary: false,
  isVerified: false,
  lastVerifyEmailDate: 0,
  visibility: 0,
})

type Writeable<T> = {-readonly [P in keyof T]: T[P]}
type EmailRow = Writeable<T.RPCGen.Email>

type Store = T.Immutable<{
  emails: Map<string, EmailRow>
}>

const initialStore: Store = {
  emails: new Map(),
}

export type State = Store & {
  dispatch: {
    notifyEmailAddressEmailsChanged: (list: ReadonlyArray<T.RPCChat.Keybase1.Email>) => void
    notifyEmailVerified: (email: string) => void
    resetState: () => void
    // call after a verification email RPC succeeds; drives the resend cooldown UI
    sentVerificationEmail: (email: string) => void
  }
}

export const useSettingsEmailState = Z.createZustand<State>('settings-email', set => {
  const dispatch: State['dispatch'] = {
    notifyEmailAddressEmailsChanged: list => {
      set(s => {
        s.emails = new Map(list.map(row => [row.email, {...makeEmailRow(), ...row}]))
      })
    },
    notifyEmailVerified: (email: string) => {
      set(s => {
        const old = s.emails.get(email)
        if (old) {
          old.isVerified = true
        } else {
          logger.warn('emailVerified on unknown email?')
        }
      })
    },
    resetState: Z.defaultReset,
    sentVerificationEmail: email => {
      set(s => {
        const old = s.emails.get(email) ?? {
          ...makeEmailRow(),
          email,
          isVerified: false,
        }
        old.lastVerifyEmailDate = new Date().getTime() / 1000
        s.emails.set(email, old)
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
