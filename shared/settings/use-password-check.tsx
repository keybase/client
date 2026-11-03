import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import logger from '@/logger'

export const usePasswordCheck = () => {
  const checkPasswordRPC = C.useRPC(T.RPCGen.accountPassphraseCheckRpcPromise)
  const [checkPasswordIsCorrect, setCheckPasswordIsCorrect] = React.useState<boolean | undefined>(undefined)
  // Only the latest check's answer stands: answers can come back out of order.
  const latestCheckRef = React.useRef(0)

  const checkPassword = React.useCallback(
    (passphrase: string) => {
      const checkID = ++latestCheckRef.current
      setCheckPasswordIsCorrect(undefined)
      checkPasswordRPC(
        [{passphrase}, C.waitingKeySettingsCheckPassword],
        result => {
          if (checkID === latestCheckRef.current) setCheckPasswordIsCorrect(result)
        },
        error => {
          logger.warn('Error checking password', error)
          if (checkID === latestCheckRef.current) setCheckPasswordIsCorrect(undefined)
        }
      )
    },
    [checkPasswordRPC]
  )

  const reset = React.useCallback(() => {
    latestCheckRef.current++
    setCheckPasswordIsCorrect(undefined)
  }, [])

  return {checkPassword, checkPasswordIsCorrect, reset}
}
