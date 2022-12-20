import * as React from 'react'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import {anyWaiting} from '../../constants/waiting'
import VerifyPhoneNumber, {type Props} from './verify'

type OwnProps = {}

type WatcherProps = Props & {
  onCleanup: () => void
  onSuccess: () => void
  verificationStatus?: 'success' | 'error'
}
// Watches for verification to succeed and exits
export class WatchForSuccess extends React.Component<WatcherProps> {
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

export default Container.connect(
  state => ({
    error: state.settings.phoneNumbers.verificationState === 'error' ? state.settings.phoneNumbers.error : '',
    phoneNumber: state.settings.phoneNumbers.pendingVerification,
    resendWaiting: anyWaiting(
      state,
      SettingsConstants.resendVerificationForPhoneWaitingKey,
      SettingsConstants.addPhoneNumberWaitingKey
    ),
    verificationStatus: state.settings.phoneNumbers.verificationState,
    verifyWaiting: anyWaiting(state, SettingsConstants.verifyPhoneNumberWaitingKey),
  }),
  dispatch => ({
    _onContinue: (phoneNumber: string, code: string) =>
      dispatch(SettingsGen.createVerifyPhoneNumber({code, phoneNumber})),
    _onResend: (phoneNumber: string) =>
      dispatch(SettingsGen.createResendVerificationForPhoneNumber({phoneNumber})),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onCleanup: () => dispatch(SettingsGen.createClearPhoneNumberAdd()),
    onSuccess: () => dispatch(RouteTreeGen.createClearModals()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    error: stateProps.error,
    onBack: dispatchProps.onBack,
    onCleanup: dispatchProps.onCleanup,
    onContinue: (code: string) => dispatchProps._onContinue(stateProps.phoneNumber, code),
    onResend: () => dispatchProps._onResend(stateProps.phoneNumber),
    onSuccess: dispatchProps.onSuccess,
    phoneNumber: stateProps.phoneNumber,
    resendWaiting: stateProps.resendWaiting,
    verificationStatus: stateProps.verificationStatus,
    verifyWaiting: stateProps.verifyWaiting,
  })
)(WatchForSuccess)
