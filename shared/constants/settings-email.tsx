import * as Z from '@/util/zustand'
import * as C from '@/constants'
import * as T from './types'
import {isValidEmail} from '@/util/simple-validators'
import {RPCError} from '@/util/errors'
import logger from '@/logger'

export const addEmailWaitingKey = 'settings:addEmail'

const makeAddEmailError = (err: RPCError): string => {
  switch (err.code) {
    case T.RPCGen.StatusCode.scratelimit:
      return "Sorry, you've added too many email addresses lately. Please try again later."
    case T.RPCGen.StatusCode.scemailtaken:
      return 'This email is already claimed by another user.'
    case T.RPCGen.StatusCode.scemaillimitexceeded:
      return 'You have too many emails, delete one and try again.'
    case T.RPCGen.StatusCode.scinputerror:
      return 'Invalid email.'
    default:
      return err.message
  }
}

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
  addingEmail: string
  emails: Map<string, EmailRow>
  error: string
  newEmail: string
}>

const initialStore: Store = {
  addedEmail: '',
  addingEmail: '',
  emails: new Map(),
  error: '',
  newEmail: '',
}

export interface State extends Store {
  dispatch: {
    addEmail: (email: string, searchable: boolean) => void
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
    resetAddingEmail: () => void
    resetState: 'default'
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    addEmail: (email, searchable) => {
      set(s => {
        const emailError = isValidEmail(email)
        s.addingEmail = email
        s.error = emailError
      })
      const f = async () => {
        if (get().error) {
          logger.info('email error; bailing')
          return
        }
        try {
          await T.RPCGen.emailsAddEmailRpcPromise(
            {
              email,
              visibility: searchable
                ? T.RPCGen.IdentityVisibility.public
                : T.RPCGen.IdentityVisibility.private,
            },
            addEmailWaitingKey
          )
          logger.info('success')
          if (email !== get().addingEmail) {
            logger.warn("addedEmail: doesn't match")
            return
          }
          set(s => {
            s.addedEmail = email
            s.addingEmail = ''
            s.error = ''
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn(`error: ${error.message}`)
          const msg = makeAddEmailError(error)
          if (email !== get().addingEmail) {
            logger.warn("addedEmail: doesn't match")
            return
          }
          set(s => {
            s.addedEmail = ''
            s.error = msg
          })
        }
      }
      C.ignorePromise(f())
    },
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
      C.ignorePromise(f())
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
    resetAddingEmail: () => {
      set(s => {
        s.addingEmail = ''
        s.error = ''
      })
    },
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
