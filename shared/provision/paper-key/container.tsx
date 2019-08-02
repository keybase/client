import * as ProvisionGen from '../../actions/provision-gen'
import PaperKey from '.'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'
import * as LoginGen from '../../actions/login-gen'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  _configuredAccounts: state.config.configuredAccounts,
  error: state.provision.error.stringValue(),
  hint: `${state.provision.codePageOtherDeviceName || ''}...`,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
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
        loggedInAccounts.size > 0 ? () => dispatchProps._onLogIn(loggedInAccounts.get(0) || '') : undefined,
      onSubmit: dispatchProps.onSubmit,
    }
  }
)(PaperKey)
