import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {makePhoneError} from '@/stores/settings-phone'

export const useAddPhoneNumber = () => {
  const addPhoneNumber = C.useRPC(T.RPCGen.phoneNumbersAddPhoneNumberRpcPromise)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneAddPhoneNumber)
  const [error, setError] = React.useState('')

  const clearError = () => {
    setError('')
  }

  const submitPhoneNumber = (
    phoneNumber: string,
    searchable: boolean,
    onSuccess: (phoneNumber: string) => void
  ) => {
    clearError()
    addPhoneNumber(
      [
        {
          phoneNumber,
          visibility: searchable
            ? T.RPCGen.IdentityVisibility.public
            : T.RPCGen.IdentityVisibility.private,
        },
        C.waitingKeySettingsPhoneAddPhoneNumber,
      ],
      () => {
        onSuccess(phoneNumber)
      },
      error_ => {
        setError(makePhoneError(error_))
      }
    )
  }

  return {clearError, error, submitPhoneNumber, waiting}
}

type UsePhoneVerificationParams = {
  initialResend?: boolean
  onSuccess?: () => void
  phoneNumber: string
}

export const usePhoneVerification = ({
  initialResend = false,
  onSuccess,
  phoneNumber,
}: UsePhoneVerificationParams) => {
  const resendVerification = C.useRPC(T.RPCGen.phoneNumbersResendVerificationForPhoneNumberRpcPromise)
  const verifyPhoneNumberRpc = C.useRPC(T.RPCGen.phoneNumbersVerifyPhoneNumberRpcPromise)
  const [error, setError] = React.useState('')
  const initialResendDone = React.useRef(false)

  const resendVerificationForPhone = React.useCallback((phoneNumberToVerify: string) => {
    setError('')
    resendVerification(
      [{phoneNumber: phoneNumberToVerify}, C.waitingKeySettingsPhoneResendVerification],
      () => {},
      error_ => {
        setError(makePhoneError(error_))
      }
    )
  }, [resendVerification])

  const verifyPhoneNumber = React.useCallback((phoneNumberToVerify: string, code: string) => {
    setError('')
    verifyPhoneNumberRpc(
      [{code, phoneNumber: phoneNumberToVerify}, C.waitingKeySettingsPhoneVerifyPhoneNumber],
      () => {
        setError('')
        onSuccess?.()
      },
      error_ => {
        setError(makePhoneError(error_))
      }
    )
  }, [onSuccess, verifyPhoneNumberRpc])

  React.useEffect(() => {
    if (!initialResend || initialResendDone.current) {
      return
    }
    initialResendDone.current = true
    resendVerificationForPhone(phoneNumber)
  }, [initialResend, phoneNumber, resendVerificationForPhone])

  return {error, resendVerificationForPhone, verifyPhoneNumber}
}
