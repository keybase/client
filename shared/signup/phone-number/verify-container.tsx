import * as React from 'react'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import {anyWaiting} from '../../constants/waiting'
import VerifyPhoneNumber, {Props} from './verify'

const mapStateToProps = (state: Container.TypedState) => ({
  error: state.settings.phoneNumbers.verificationState === 'error' ? state.settings.phoneNumbers.error : '',
  phoneNumber: state.settings.phoneNumbers.pendingVerification,
  resendWaiting: anyWaiting(
    state,
    SettingsConstants.resendVerificationForPhoneWaitingKey,
    SettingsConstants.addPhoneNumberWaitingKey
  ),
  verificationStatus: state.settings.phoneNumbers.verificationState,
  verifyWaiting: anyWaiting(state, SettingsConstants.verifyPhoneNumberWaitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onContinue: (phoneNumber: string, code: string) =>
    dispatch(SettingsGen.createVerifyPhoneNumber({code, phoneNumber})),
  _onResend: (phoneNumber: string) =>
    dispatch(SettingsGen.createResendVerificationForPhoneNumber({phoneNumber})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onCleanup: () => dispatch(SettingsGen.createClearPhoneNumberAdd()),
  onSuccess: () => dispatch(RouteTreeGen.createClearModals()),
})

type WatcherProps = Props & {
  onCleanup: () => void
  onSuccess: () => void
  verificationStatus: 'success' | 'error' | null
}
// Watches for verification to succeed and exits
class WatchForSuccess extends React.Component<WatcherProps> {
  componentDidUpdate() {
    if (this.props.verificationStatus === 'success') {
      this.props.onSuccess()
    }
  }
  componentWillUnmount() {
    this.props.onCleanup()
  }
  render() {
    return (
      <VerifyPhoneNumber
        error={this.props.error}
        onBack={this.props.onBack}
        onContinue={this.props.onContinue}
        onResend={this.props.onResend}
        phoneNumber={this.props.phoneNumber}
        resendWaiting={this.props.resendWaiting}
        verifyWaiting={this.props.verifyWaiting}
      />
    )
  }
}

const ConnectedVerifyPhoneNumber = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: {}) => ({
    ...o,
    ...s,
    onBack: d.onBack,
    onCleanup: d.onCleanup,
    onContinue: (code: string) => d._onContinue(s.phoneNumber, code),
    onResend: () => d._onResend(s.phoneNumber),
    onSuccess: d.onSuccess,
  }),
  'ConnectedVerifyPhoneNumber'
)(WatchForSuccess)

export default ConnectedVerifyPhoneNumber
