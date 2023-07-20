import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsConstants from '../../constants/settings'
import * as RouterConstants from '../../constants/router2'
import VerifyPhoneNumber, {type Props} from './verify'

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

export default () => {
  const error = SettingsConstants.usePhoneState(s => (s.verificationState === 'error' ? s.error : ''))
  const phoneNumber = SettingsConstants.usePhoneState(s => s.pendingVerification)
  const resendWaiting = Container.useAnyWaiting([
    SettingsConstants.resendVerificationForPhoneWaitingKey,
    SettingsConstants.addPhoneNumberWaitingKey,
  ])
  const verificationStatus = SettingsConstants.usePhoneState(s => s.verificationState)
  const verifyWaiting = Container.useAnyWaiting(SettingsConstants.verifyPhoneNumberWaitingKey)

  const verifyPhoneNumber = SettingsConstants.usePhoneState(s => s.dispatch.verifyPhoneNumber)
  const resendVerificationForPhone = SettingsConstants.usePhoneState(
    s => s.dispatch.resendVerificationForPhone
  )

  const clearPhoneNumberAdd = SettingsConstants.usePhoneState(s => s.dispatch.clearPhoneNumberAdd)

  const _onContinue = (phoneNumber: string, code: string) => {
    verifyPhoneNumber(phoneNumber, code)
  }
  const _onResend = (phoneNumber: string) => {
    resendVerificationForPhone(phoneNumber)
  }
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const onCleanup = clearPhoneNumberAdd
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onSuccess = () => {
    clearModals()
  }
  const props = {
    error: error,
    onBack: onBack,
    onCleanup: onCleanup,
    onContinue: (code: string) => _onContinue(phoneNumber, code),
    onResend: () => _onResend(phoneNumber),
    onSuccess: onSuccess,
    phoneNumber: phoneNumber,
    resendWaiting: resendWaiting,
    verificationStatus: verificationStatus,
    verifyWaiting: verifyWaiting,
  }
  return <WatchForSuccess {...props} />
}
