import * as ProvisionGen from '../../actions/provision-gen'
import PaperKey from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'
import {RouteProps} from '../../route-tree/render-route'
import * as LoginGen from '../../actions/login-gen'
type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: Container.TypedState) => ({
  error: state.provision.error.stringValue(),
  hint: `${state.provision.codePageOtherDeviceName || ''}...`,
  configuredAccounts: state.config.configuredAccounts,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
  onSubmit: (paperKey: string) =>
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey: new HiddenString(paperKey)})),
})

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o) => {
  const loggedInAccounts = s.configuredAccounts.filter(account => account.hasStoredSecret)

  return {
    ...o,
    ...s,
    onBack: loggedInAccounts.size > 0 ? () => d.onLogIn(loggedInAccounts.get(0).username) : undefined,
    onSubmit: d.onSubmit,
  }
})(PaperKey)
