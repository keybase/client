import type * as T from '@/constants/types'
import * as RPCGen from '@/constants/rpc/rpc-gen'
import * as Z from '@/util/zustand'
import type {RPCError} from '@/util/errors'
import type {e164ToDisplay as e164ToDisplayType} from '@/util/phone-numbers'

export const makePhoneRow = (): PhoneRow => ({
  displayNumber: '',
  e164: '',
  searchable: false,
  superseded: false,
  verified: false,
})

const toPhoneRow = (p: T.RPCGen.UserPhoneNumber) => {
  const {e164ToDisplay} = require('@/util/phone-numbers') as {e164ToDisplay: typeof e164ToDisplayType}
  return {
    ...makePhoneRow(),
    displayNumber: e164ToDisplay(p.phoneNumber),
    e164: p.phoneNumber,
    searchable: p.visibility === RPCGen.IdentityVisibility.public,
    superseded: p.superseded,
    verified: p.verified,
  }
}

export const makePhoneError = (e: RPCError) => {
  switch (e.code) {
    case RPCGen.StatusCode.scphonenumberwrongverificationcode:
      return 'Incorrect code, please try again.'
    case RPCGen.StatusCode.scphonenumberunknown:
      return e.desc
    case RPCGen.StatusCode.scphonenumberalreadyverified:
      return 'This phone number is already verified.'
    case RPCGen.StatusCode.scphonenumberverificationcodeexpired:
      return 'Verification code expired, resend and try again.'
    case RPCGen.StatusCode.scratelimit:
      return 'Sorry, tried too many guesses in a short period of time. Please try again later.'
    default:
      return e.message
  }
}

export type PhoneRow = {
  displayNumber: string
  e164: string
  searchable: boolean
  superseded: boolean
  verified: boolean
}

type Store = T.Immutable<{
  phones?: Map<string, PhoneRow>
}>

const initialStore: Store = {
  phones: undefined,
}

export type State = Store & {
  dispatch: {
    notifyPhoneNumberPhoneNumbersChanged: (list?: ReadonlyArray<T.RPCChat.Keybase1.UserPhoneNumber>) => void
    resetState: () => void
    setNumbers: (phoneNumbers?: ReadonlyArray<T.RPCChat.Keybase1.UserPhoneNumber>) => void
  }
}

export const useSettingsPhoneState = Z.createZustand<State>('settings-phone', set => {
  const dispatch: State['dispatch'] = {
    notifyPhoneNumberPhoneNumbersChanged: list => {
      set(s => {
        s.phones = new Map((list ?? []).map(row => [row.phoneNumber, toPhoneRow(row)]))
      })
    },
    resetState: Z.defaultReset,
    setNumbers: phoneNumbers => {
      set(s => {
        s.phones = phoneNumbers?.reduce((map, row) => {
          if (map.get(row.phoneNumber) && !map.get(row.phoneNumber)?.superseded) {
            return map
          }
          map.set(row.phoneNumber, toPhoneRow(row))
          return map
        }, new Map<string, PhoneRow>())
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
