import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import HiddenString from '../../util/hidden-string'
import Password from '.'
import * as Container from '../../util/container'

type OwnProps = {}

export default Container.connect(
  state => ({
    error: state.provision.error.stringValue(),
    resetEmailSent: state.recoverPassword.resetEmailSent,
    username: state.provision.username,
    waiting: Container.anyWaiting(state, Constants.waitingKey),
  }),
  dispatch => ({
    _onForgotPassword: (username: string) =>
      dispatch(RecoverPasswordGen.createStartRecoverPassword({abortProvisioning: true, username})),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSubmit: (password: string) =>
      dispatch(ProvisionGen.createSubmitPassword({password: new HiddenString(password)})),
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    ...d,
    onForgotPassword: () => d._onForgotPassword(s.username),
    onSubmit: (password: string) => !s.waiting && d.onSubmit(password),
  })
)(Password)
