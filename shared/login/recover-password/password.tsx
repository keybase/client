import * as C from '../../constants'
import * as React from 'react'
import _Password from '../../settings/password'

const Password = () => {
  const error = C.useRecoverState(s => s.passwordError)
  const waiting = C.useAnyWaiting(C.recoverWaitingKey)
  const submitPassword = C.useRecoverState(s => s.dispatch.dynamic.submitPassword)
  const onSave = (p: string) => {
    submitPassword?.(p)
  }
  return <_Password error={error} hasRandomPW={false} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
