import * as RPCChatTypes from './types/rpc-chat-gen'
import * as RPCTypes from './types/rpc-gen'
import * as Z from '../util/zustand'
import logger from '../logger'
import {RPCError} from '../util/errors'
import type {
  e164ToDisplay as e164ToDisplayType,
  phoneUtil as phoneUtilType,
  ValidationResult as ValidationResultType,
  PhoneNumberFormat as PhoneNumberFormatType,
} from '../util/phone-numbers'

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
  const {phoneUtil, ValidationResult, PhoneNumberFormat} = require('../util/phone-numbers') as {
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
  } catch (e) {
    return null
  }
}

const toPhoneRow = (p: RPCTypes.UserPhoneNumber) => {
  const {e164ToDisplay} = require('../util/phone-numbers') as {e164ToDisplay: typeof e164ToDisplayType}
  return {
    ...makePhoneRow(),
    displayNumber: e164ToDisplay(p.phoneNumber),
    e164: p.phoneNumber,
    searchable: p.visibility === RPCTypes.IdentityVisibility.public,
    superseded: p.superseded,
    verified: p.verified,
  }
}

export const makePhoneError = (e: RPCError) => {
  switch (e.code) {
    case RPCTypes.StatusCode.scphonenumberwrongverificationcode:
      return 'Incorrect code, please try again.'
    case RPCTypes.StatusCode.scphonenumberunknown:
      return e.desc
    case RPCTypes.StatusCode.scphonenumberalreadyverified:
      return 'This phone number is already verified.'
    case RPCTypes.StatusCode.scphonenumberverificationcodeexpired:
      return 'Verification code expired, resend and try again.'
    case RPCTypes.StatusCode.scratelimit:
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

type Store = {
  addedPhone: boolean
  defaultCountry?: string
  error: string
  pendingVerification: string
  phones?: Map<string, PhoneRow>
  verificationState?: 'success' | 'error'
}

const initialStore: Store = {
  addedPhone: false,
  defaultCountry: undefined,
  error: '',
  pendingVerification: '',
  phones: undefined,
  verificationState: undefined,
}

export type State = Store & {
  dispatch: {
    addPhoneNumber: (phoneNumber: string, searchable: boolean) => void
    editPhone: (phone: string, del?: boolean, setSearchable?: boolean) => void
    loadDefaultPhoneCountry: () => void
    notifyPhoneNumberPhoneNumbersChanged: (list?: RPCChatTypes.Keybase1.UserPhoneNumber[]) => void
    resetState: 'default'
    setNumbers: (phoneNumbers?: RPCChatTypes.Keybase1.UserPhoneNumber[]) => void
    verifyPhoneNumber: (phoneNumber: string, code: string) => void
    resendVerificationForPhone: (phoneNumber: string) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  // const reduxDispatch = Z.getReduxDispatch()
  const dispatch: State['dispatch'] = {
    addPhoneNumber: (phoneNumber, searchable) => {
      const f = async () => {
        logger.info('adding phone number')
        const visibility = searchable
          ? RPCTypes.IdentityVisibility.public
          : RPCTypes.IdentityVisibility.private
        try {
          await RPCTypes.phoneNumbersAddPhoneNumberRpcPromise(
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
      Z.ignorePromise(f())
    },
    editPhone: (phoneNumber, del, setSearchable) => {
      const f = async () => {
        if (del) {
          await RPCTypes.phoneNumbersDeletePhoneNumberRpcPromise({phoneNumber})
        }
        if (setSearchable !== undefined) {
          await RPCTypes.phoneNumbersSetVisibilityPhoneNumberRpcPromise({
            phoneNumber,
            visibility: setSearchable
              ? RPCChatTypes.Keybase1.IdentityVisibility.public
              : RPCChatTypes.Keybase1.IdentityVisibility.private,
          })
        }
      }
      Z.ignorePromise(f())
    },
    loadDefaultPhoneCountry: () => {
      const f = async () => {
        // noop if we've already loaded it
        if (get().defaultCountry) {
          return
        }
        const country = await RPCTypes.accountGuessCurrentLocationRpcPromise({
          defaultCountry: 'US',
        })
        set(s => {
          s.defaultCountry = country
        })
      }
      Z.ignorePromise(f())
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
          await RPCTypes.phoneNumbersResendVerificationForPhoneNumberRpcPromise(
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
      Z.ignorePromise(f())
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
          await RPCTypes.phoneNumbersVerifyPhoneNumberRpcPromise(
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
      Z.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
