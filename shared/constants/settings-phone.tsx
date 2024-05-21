import * as T from './types'
import * as C from '.'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import type {
  e164ToDisplay as e164ToDisplayType,
  phoneUtil as phoneUtilType,
  ValidationResult as ValidationResultType,
  PhoneNumberFormat as PhoneNumberFormatType,
} from '@/util/phone-numbers'

export const makePhoneRow = (): PhoneRow => ({
  displayNumber: '',
  e164: '',
  searchable: false,
  superseded: false,
  verified: false,
})

export const verifyPhoneNumberWaitingKey = 'settings:verifyPhoneNumber'
export const addPhoneNumberWaitingKey = 'settings:addPhoneNumber'
export const resendVerificationForPhoneWaitingKey = 'settings:resendVerificationForPhone'

// Get phone number in e.164, or null if we can't parse it.
export const getE164 = (phoneNumber: string, countryCode?: string) => {
  const {phoneUtil, ValidationResult, PhoneNumberFormat} = require('@/util/phone-numbers') as {
    phoneUtil: typeof phoneUtilType
    ValidationResult: typeof ValidationResultType
    PhoneNumberFormat: typeof PhoneNumberFormatType
  }
  try {
    const parsed = countryCode ? phoneUtil.parse(phoneNumber, countryCode) : phoneUtil.parse(phoneNumber)
    const reason = phoneUtil.isPossibleNumberWithReason(parsed)
    if (reason !== ValidationResult.IS_POSSIBLE) {
      return null
    }
    return phoneUtil.format(parsed, PhoneNumberFormat.E164)
  } catch {
    return null
  }
}

const toPhoneRow = (p: T.RPCGen.UserPhoneNumber) => {
  const {e164ToDisplay} = require('@/util/phone-numbers') as {e164ToDisplay: typeof e164ToDisplayType}
  return {
    ...makePhoneRow(),
    displayNumber: e164ToDisplay(p.phoneNumber),
    e164: p.phoneNumber,
    searchable: p.visibility === T.RPCGen.IdentityVisibility.public,
    superseded: p.superseded,
    verified: p.verified,
  }
}

export const makePhoneError = (e: RPCError) => {
  switch (e.code) {
    case T.RPCGen.StatusCode.scphonenumberwrongverificationcode:
      return 'Incorrect code, please try again.'
    case T.RPCGen.StatusCode.scphonenumberunknown:
      return e.desc
    case T.RPCGen.StatusCode.scphonenumberalreadyverified:
      return 'This phone number is already verified.'
    case T.RPCGen.StatusCode.scphonenumberverificationcodeexpired:
      return 'Verification code expired, resend and try again.'
    case T.RPCGen.StatusCode.scratelimit:
      return 'Sorry, tried too many guesses in a short period of time. Please try again later.'
    default:
      return e.message
  }
}

type PhoneRow = {
  displayNumber: string
  e164: string
  searchable: boolean
  superseded: boolean
  verified: boolean
}

type Store = T.Immutable<{
  addedPhone: boolean
  defaultCountry?: string
  error: string
  pendingVerification: string
  phones?: Map<string, PhoneRow>
  verificationState?: 'success' | 'error'
}>

const initialStore: Store = {
  addedPhone: false,
  defaultCountry: undefined,
  error: '',
  pendingVerification: '',
  phones: undefined,
  verificationState: undefined,
}

export interface State extends Store {
  dispatch: {
    addPhoneNumber: (phoneNumber: string, searchable: boolean) => void
    clearAddedPhone: () => void
    clearPhoneNumberAdd: () => void
    clearPhoneNumberErrors: () => void
    editPhone: (phone: string, del?: boolean, setSearchable?: boolean) => void
    loadDefaultPhoneCountry: () => void
    notifyPhoneNumberPhoneNumbersChanged: (list?: ReadonlyArray<T.RPCChat.Keybase1.UserPhoneNumber>) => void
    resendVerificationForPhone: (phoneNumber: string) => void
    resetState: 'default'
    setNumbers: (phoneNumbers?: ReadonlyArray<T.RPCChat.Keybase1.UserPhoneNumber>) => void
    verifyPhoneNumber: (phoneNumber: string, code: string) => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    addPhoneNumber: (phoneNumber, searchable) => {
      const f = async () => {
        logger.info('adding phone number')
        const visibility = searchable
          ? T.RPCGen.IdentityVisibility.public
          : T.RPCGen.IdentityVisibility.private
        try {
          await T.RPCGen.phoneNumbersAddPhoneNumberRpcPromise(
            {phoneNumber, visibility},
            addPhoneNumberWaitingKey
          )
          logger.info('success')
          set(s => {
            s.error = ''
            s.pendingVerification = phoneNumber
            s.verificationState = undefined
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn('error ', error.message)
          const message = makePhoneError(error)
          set(s => {
            s.error = message
            s.pendingVerification = phoneNumber
            s.verificationState = undefined
          })
        }
      }
      C.ignorePromise(f())
    },
    clearAddedPhone: () => {
      set(s => {
        s.addedPhone = false
      })
    },
    clearPhoneNumberAdd: () => {
      set(s => {
        s.error = ''
        s.pendingVerification = ''
        s.verificationState = undefined
      })
    },
    clearPhoneNumberErrors: () => {
      set(s => {
        s.error = ''
      })
    },
    editPhone: (phoneNumber, del, setSearchable) => {
      const f = async () => {
        if (del) {
          await T.RPCGen.phoneNumbersDeletePhoneNumberRpcPromise({phoneNumber})
        }
        if (setSearchable !== undefined) {
          await T.RPCGen.phoneNumbersSetVisibilityPhoneNumberRpcPromise({
            phoneNumber,
            visibility: setSearchable
              ? T.RPCChat.Keybase1.IdentityVisibility.public
              : T.RPCChat.Keybase1.IdentityVisibility.private,
          })
        }
      }
      C.ignorePromise(f())
    },
    loadDefaultPhoneCountry: () => {
      const f = async () => {
        // noop if we've already loaded it
        if (get().defaultCountry) {
          return
        }
        const country = await T.RPCGen.accountGuessCurrentLocationRpcPromise({
          defaultCountry: 'US',
        })
        set(s => {
          s.defaultCountry = country
        })
      }
      C.ignorePromise(f())
    },
    notifyPhoneNumberPhoneNumbersChanged: list => {
      set(s => {
        s.phones = new Map((list ?? []).map(row => [row.phoneNumber, toPhoneRow(row)]))
      })
    },
    resendVerificationForPhone: phoneNumber => {
      set(s => {
        s.error = ''
        s.pendingVerification = phoneNumber
        s.verificationState = undefined
      })
      const f = async () => {
        logger.info(`resending verification code for ${phoneNumber}`)
        try {
          await T.RPCGen.phoneNumbersResendVerificationForPhoneNumberRpcPromise(
            {phoneNumber},
            resendVerificationForPhoneWaitingKey
          )
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          const message = makePhoneError(error)
          logger.warn('error ', message)
          set(s => {
            if (phoneNumber !== s.pendingVerification) {
              logger.warn("Got verifiedPhoneNumber but number doesn't match")
              return
            }
            s.addedPhone = false
            s.error = message
            s.verificationState = 'error'
          })
        }
      }
      C.ignorePromise(f())
    },
    resetState: 'default',
    setNumbers: phoneNumbers => {
      set(s => {
        s.phones = phoneNumbers?.reduce<Map<string, PhoneRow>>((map, row) => {
          if (map.get(row.phoneNumber) && !map.get(row.phoneNumber)?.superseded) {
            return map
          }
          map.set(row.phoneNumber, toPhoneRow(row))
          return map
        }, new Map())
      })
    },
    verifyPhoneNumber: (phoneNumber, code) => {
      const f = async () => {
        logger.info('verifying phone number')
        try {
          await T.RPCGen.phoneNumbersVerifyPhoneNumberRpcPromise(
            {code, phoneNumber},
            verifyPhoneNumberWaitingKey
          )
          logger.info('success')
          set(s => {
            if (phoneNumber !== s.pendingVerification) {
              logger.warn("Got verifiedPhoneNumber but number doesn't match")
              return
            }
            s.addedPhone = true
            s.error = ''
            s.verificationState = 'success'
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          const message = makePhoneError(error)
          logger.warn('error ', message)
          set(s => {
            if (phoneNumber !== s.pendingVerification) {
              logger.warn("Got verifiedPhoneNumber but number doesn't match")
              return
            }
            s.addedPhone = false
            s.error = message
            s.verificationState = 'error'
          })
        }
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
