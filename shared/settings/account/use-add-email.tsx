import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import type {RPCError} from '@/util/errors'
import {isValidEmail} from '@/util/simple-validators'

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

export const useAddEmail = () => {
  const addEmail = C.useRPC(T.RPCGen.emailsAddEmailRpcPromise)
  const waiting = C.Waiting.useAnyWaiting(C.addEmailWaitingKey)
  const [error, setError] = React.useState('')

  const clearError = React.useCallback(() => {
    setError('')
  }, [])

  const submitEmail = (email: string, searchable: boolean, onSuccess: (email: string) => void) => {
    const emailError = isValidEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }

    setError('')
    addEmail(
      [
        {
          email,
          visibility: searchable
            ? T.RPCGen.IdentityVisibility.public
            : T.RPCGen.IdentityVisibility.private,
        },
        C.addEmailWaitingKey,
      ],
      () => {
        onSuccess(email)
      },
      error_ => {
        setError(makeAddEmailError(error_))
      }
    )
  }

  return {clearError, error, submitEmail, waiting}
}
