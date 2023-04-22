import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import HiddenString from '../../util/hidden-string'
import Password from '.'
import * as Container from '../../util/container'

export default () => {
  const error = Container.useSelector(state => state.provision.error.stringValue())
  const resetEmailSent = Container.useSelector(state => state.recoverPassword.resetEmailSent)
  const username = Container.useSelector(state => state.provision.username)
  const waiting = Container.useSelector(state => Container.anyWaiting(state, Constants.waitingKey))

  const dispatch = Container.useDispatch()
  const _onForgotPassword = (username: string) => {
    dispatch(RecoverPasswordGen.createStartRecoverPassword({abortProvisioning: true, username}))
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSubmit = (password: string) => {
    dispatch(ProvisionGen.createSubmitPassword({password: new HiddenString(password)}))
  }
  const props = {
    error,
    onBack,
    onForgotPassword: () => _onForgotPassword(username),
    onSubmit: (password: string) => !waiting && onSubmit(password),
    resetEmailSent,
    username,
    waiting,
  }
  return <Password {...props} />
}
