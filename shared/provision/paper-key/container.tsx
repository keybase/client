import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'
import * as LoginGen from '../../actions/login-gen'
import PaperKey from '.'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  _configuredAccounts: state.config.configuredAccounts,
  error: state.provision.error.stringValue(),
  hint: `${state.provision.codePageOtherDeviceName || ''}...`,
  waiting: Container.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  _onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
  onSubmit: (paperKey: string) =>
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey: new HiddenString(paperKey)})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    const loggedInAccounts = stateProps._configuredAccounts
      .filter(account => account.hasStoredSecret)
      .map(ac => ac.username)

    return {
      error: stateProps.error,
      hint: stateProps.hint,
      onBack:
        loggedInAccounts.length > 0
          ? () => dispatchProps._onLogIn(loggedInAccounts[0] || '')
          : dispatchProps._onBack,
      onSubmit: dispatchProps.onSubmit,
      waiting: stateProps.waiting,
    }
  }
)(PaperKey)
