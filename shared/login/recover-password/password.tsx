import * as React from 'react'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/recover-password'
import HiddenString from '../../util/hidden-string'
import _Password from '../../settings/password'

const Password = () => {
  const dispatch = Container.useDispatch()
  const error = Container.useSelector(s => s.recoverPassword.passwordError)
  const errErr = React.useMemo(() => new Error(error.stringValue()), [error])
  const waiting = Container.useAnyWaiting(Constants.waitingKey)

  const onSave = React.useCallback(
    (pw: string) => {
      dispatch(RecoverPasswordGen.createSubmitPassword({password: new HiddenString(pw)}))
    },
    [dispatch]
  )
  return <_Password error={errErr} hasRandomPW={false} onSave={onSave} waitingForResponse={waiting} />
}
Password.navigationOptions = {
  gesturesEnabled: false,
  header: null,
}

export default Password
