import * as React from 'react'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'
import _Password from '../../settings/password'

const Password = () => {
  const dispatch = Container.useDispatch()
  const error = Container.useSelector(s => s.recoverPassword.passwordError)
  const errErr = React.useMemo(() => new Error(error.stringValue()), [error])

  const onSave = React.useCallback((pw: string) => {
    dispatch(RecoverPasswordGen.createSubmitPassword({password: new HiddenString(pw)}))
  }, [])
  return <_Password error={errErr} hasRandomPW={false} onSave={onSave} />
}
Password.navigationOptions = {
  gesturesEnabled: false,
  header: null,
}

export default Password
