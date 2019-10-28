import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import HiddenString from '../../util/hidden-string'
import Password from '.'
import * as Container from '../../util/container'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  error: state.provision.error.stringValue(),
  resetEmailSent: state.recoverPassword.resetEmailSent,
  username: state.provision.username,
  waiting: Container.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = dispatch => ({
  _onForgotPassword: username =>
    dispatch(RecoverPasswordGen.createStartRecoverPassword({abortProvisioning: true, username})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSubmit: (password: string) =>
    dispatch(ProvisionGen.createSubmitPassword({password: new HiddenString(password)})),
  resetRecoverState: () => dispatch(RecoverPasswordGen.createResetResetPasswordState()),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => ({
  ...o,
  ...s,
  ...d,
  onForgotPassword: () => d._onForgotPassword(s.username),
}))(Password)
