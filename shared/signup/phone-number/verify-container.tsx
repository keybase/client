import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import VerifyPhoneNumber from './verify'

const mapStateToProps = (state: Container.TypedState) => ({
  error: '',
  phoneNumber: state.settings.phoneNumbers.pendingVerification,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onCancel: () => dispatch(SettingsGen.createClearPhoneNumberVerification()),
})

const ConnectedVerifyPhoneNumber = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: {}) => ({...o, ...s, ...d}),
  'ConnectedVerifyPhoneNumber'
)(VerifyPhoneNumber)

export default ConnectedVerifyPhoneNumber
