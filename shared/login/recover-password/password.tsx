import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/recover-password'
import _Password from '../../settings/password'

const Password = () => {
  const error = Constants.useState(s => s.passwordError)
  const waiting = Container.useAnyWaiting(Constants.waitingKey)
  const submitPassword = Constants.useState(s => s.dispatch.dynamic.submitPassword)
  const onSave = (p: string) => {
    submitPassword?.(p)
  }
  return <_Password error={error} hasRandomPW={false} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
