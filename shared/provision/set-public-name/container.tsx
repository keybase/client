import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/provision'
import SetPublicName from '.'
import * as Container from '../../util/container'
import {RouteProps} from '../../route-tree/render-route'
import * as LoginGen from '../../actions/login-gen'
import HiddenString from '../../util/hidden-string'

type OwnProps = {
  deviceName: string
  onChange: (text: string) => void
} & RouteProps<{}, {}>

const mapStateToProps = (state: Container.TypedState) => ({
  _existingDevices: state.provision.existingDevices,
  error: state.provision.error.stringValue(),
  loggedInAccounts: state.config.configuredAccounts
    .filter(account => account.hasStoredSecret)
    .map(account => account.username),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  _onSubmit: (name: string) => dispatch(ProvisionGen.createSubmitDeviceName({name})),
  onLogIn: (username: string) => dispatch(LoginGen.createLogin({password: new HiddenString(''), username})),
})

export default Container.compose(
  Container.withStateHandlers<any, any, any>(
    {deviceName: ''},
    {
      onChange: () => (deviceName: string) => ({deviceName: Constants.cleanDeviceName(deviceName)}),
    }
  ),
  Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, ownProps) => {
    const submitEnabled = !!(ownProps.deviceName.length >= 3 && ownProps.deviceName.length <= 64)
    const onSubmit = submitEnabled ? () => dispatchProps._onSubmit(ownProps.deviceName) : null
    return {
      deviceName: ownProps.deviceName,
      error: stateProps.error,
      onBack:
        stateProps.loggedInAccounts.size > 0
          ? () => dispatchProps.onLogIn(stateProps.loggedInAccounts.get(0))
          : null,
      onChange: ownProps.onChange,
      onSubmit,
    }
  }),
  Container.safeSubmit(['onSubmit', 'onBack'], ['deviceName', 'error'])
  // @ts-ignore
)(SetPublicName)
