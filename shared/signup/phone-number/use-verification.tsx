import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {makePhoneError} from '@/stores/settings-phone'

const useMountedRef = () => {
  const mountedRef = React.useRef(true)

  React.useEffect(
    () => () => {
      mountedRef.current = false
    },
    []
  )

  return mountedRef
}

export const useAddPhoneNumber = () => {
  const addPhoneNumber = C.useRPC(T.RPCGen.phoneNumbersAddPhoneNumberRpcPromise)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsPhoneAddPhoneNumber)
  const [error, setError] = React.useState('')
  const mountedRef = useMountedRef()

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
        if (mountedRef.current) {
          setError(makePhoneError(error_))
        }
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
  const mountedRef = useMountedRef()

  const resendVerificationForPhone = (phoneNumberToVerify: string) => {
    setError('')
    resendVerification(
      [{phoneNumber: phoneNumberToVerify}, C.waitingKeySettingsPhoneResendVerification],
      () => {},
      error_ => {
        if (mountedRef.current) {
          setError(makePhoneError(error_))
        }
      }
    )
  }

  const verifyPhoneNumber = (phoneNumberToVerify: string, code: string) => {
    setError('')
    verifyPhoneNumberRpc(
      [{code, phoneNumber: phoneNumberToVerify}, C.waitingKeySettingsPhoneVerifyPhoneNumber],
      () => {
        if (mountedRef.current) {
          setError('')
          onSuccess?.()
        }
      },
      error_ => {
        if (mountedRef.current) {
          setError(makePhoneError(error_))
        }
      }
    )
  }

  React.useEffect(() => {
    if (!initialResend || initialResendDone.current) {
      return
    }
    initialResendDone.current = true
    resendVerificationForPhone(phoneNumber)
  }, [initialResend, phoneNumber, resendVerificationForPhone])

  return {error, resendVerificationForPhone, verifyPhoneNumber}
}
