import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import logger from '@/logger'

export const usePasswordCheck = () => {
  const checkPasswordRPC = C.useRPC(T.RPCGen.accountPassphraseCheckRpcPromise)
  const [checkPasswordIsCorrect, setCheckPasswordIsCorrect] = React.useState<boolean | undefined>(undefined)
  const mountedRef = React.useRef(true)

  React.useEffect(
    () => () => {
      mountedRef.current = false
    },
    []
  )

  const checkPassword = React.useCallback(
    (passphrase: string) => {
      setCheckPasswordIsCorrect(undefined)
      checkPasswordRPC(
        [{passphrase}, C.waitingKeySettingsCheckPassword],
        result => {
          if (mountedRef.current) {
            setCheckPasswordIsCorrect(result)
          }
        },
        error => {
          logger.warn('Error checking password', error)
          if (mountedRef.current) {
            setCheckPasswordIsCorrect(undefined)
          }
        }
      )
    },
    [checkPasswordRPC]
  )

  const reset = React.useCallback(() => {
    setCheckPasswordIsCorrect(undefined)
  }, [])

  return {checkPassword, checkPasswordIsCorrect, reset}
}
