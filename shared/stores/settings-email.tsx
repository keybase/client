import * as Z from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
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
  addedEmail: string // show banner with dismiss on account settings
  emails: Map<string, EmailRow>
}>

const initialStore: Store = {
  addedEmail: '',
  emails: new Map(),
}

export type State = Store & {
  dispatch: {
    editEmail: (p: {
      email: string
      delete?: boolean
      makePrimary?: boolean
      makeSearchable?: boolean
      verify?: boolean
    }) => void
    notifyEmailAddressEmailsChanged: (list: ReadonlyArray<T.RPCChat.Keybase1.Email>) => void
    notifyEmailVerified: (email: string) => void
    resetAddedEmail: () => void
    resetState: () => void
    setAddedEmail: (email: string) => void
  }
}

export const useSettingsEmailState = Z.createZustand<State>('settings-email', (set, get) => {
  const dispatch: State['dispatch'] = {
    editEmail: p => {
      const f = async () => {
        // TODO: consider allowing more than one action here
        // TODO: handle errors
        if (p.delete) {
          await T.RPCGen.emailsDeleteEmailRpcPromise({email: p.email})
          if (get().addedEmail === p.email) {
            get().dispatch.resetAddedEmail()
            return
          }
          return
        }
        if (p.makePrimary) {
          await T.RPCGen.emailsSetPrimaryEmailRpcPromise({email: p.email})
          return
        }
        if (p.verify) {
          await T.RPCGen.emailsSendVerificationEmailRpcPromise({email: p.email})
          set(s => {
            s.addedEmail = p.email
            const old = s.emails.get(p.email) ?? {
              ...makeEmailRow(),
              email: p.email,
              isVerified: false,
            }
            old.lastVerifyEmailDate = new Date().getTime() / 1000
            s.emails.set(p.email, old)
          })
        }
        if (p.makeSearchable !== undefined) {
          await T.RPCGen.emailsSetVisibilityEmailRpcPromise({
            email: p.email,
            visibility: p.makeSearchable
              ? T.RPCChat.Keybase1.IdentityVisibility.public
              : T.RPCChat.Keybase1.IdentityVisibility.private,
          })
          return
        }
        logger.warn('Empty editEmail action')
      }
      ignorePromise(f())
    },
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
        s.addedEmail = ''
      })
    },
    resetAddedEmail: () => {
      set(s => {
        s.addedEmail = ''
      })
    },
    resetState: Z.defaultReset,
    setAddedEmail: email => {
      set(s => {
        s.addedEmail = email
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
