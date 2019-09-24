import * as ProvisionGen from '../../actions/provision-gen'
import * as LoginGen from '../../actions/login-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import HiddenString from '../../util/hidden-string'
import Password from '.'
import * as Container from '../../util/container'
import flags from '../../util/feature-flags'

type OwnProps = {}

const mapStateToProps = state => ({
  error: state.provision.error.stringValue(),
  username: state.provision.username,
  waiting: Container.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = dispatch => ({
  _onForgotPassword: username =>
    flags.resetPipeline
      ? dispatch(RecoverPasswordGen.createStartRecoverPassword({abortProvisioning: true, username}))
      : dispatch(LoginGen.createLaunchForgotPasswordWebPage()),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSubmit: (password: string) =>
    dispatch(ProvisionGen.createSubmitPassword({password: new HiddenString(password)})),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => ({
  ...o,
  ...s,
  ...d,
  onForgotPassword: () => d._onForgotPassword(s.username),
}))(Password)
