import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import {anyWaiting} from '../../constants/waiting'
import VerifyPhoneNumber from './verify'

const mapStateToProps = (state: Container.TypedState) => ({
  error: '',
  phoneNumber: state.settings.phoneNumbers.pendingVerification,
  resendWaiting: anyWaiting(state, SettingsConstants.addPhoneNumberWaitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onContinue: (phoneNumber: string, code: string) =>
    dispatch(SettingsGen.createVerifyPhoneNumber({code, phoneNumber})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onCancel: () => dispatch(SettingsGen.createClearPhoneNumberVerification()),
})

const ConnectedVerifyPhoneNumber = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: {}) => ({
    ...o,
    ...s,
    onBack: d.onBack,
    onCancel: d.onCancel,
    onContinue: (code: string) => d._onContinue(s.phoneNumber, code),
  }),
  'ConnectedVerifyPhoneNumber'
)(VerifyPhoneNumber)

export default ConnectedVerifyPhoneNumber
