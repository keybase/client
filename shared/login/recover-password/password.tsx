import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/recover-password'
import _Password from '../../settings/password'

const Password = () => {
  const error = Constants.useState(s => s.passwordError)
  const errErr = React.useMemo(() => new Error(error), [error])
  const waiting = Container.useAnyWaiting(Constants.waitingKey)
  const submitPassword = Constants.useState(s => s.dispatch.submitPassword)
  const onSave = submitPassword
  return <_Password error={errErr} hasRandomPW={false} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
