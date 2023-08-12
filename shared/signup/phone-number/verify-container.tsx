import * as C from '../../constants'
import * as React from 'react'
import * as Container from '../../util/container'
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
  const error = C.useSettingsPhoneState(s => (s.verificationState === 'error' ? s.error : ''))
  const phoneNumber = C.useSettingsPhoneState(s => s.pendingVerification)
  const resendWaiting = Container.useAnyWaiting([
    C.resendVerificationForPhoneWaitingKey,
    C.addPhoneNumberWaitingKey,
  ])
  const verificationStatus = C.useSettingsPhoneState(s => s.verificationState)
  const verifyWaiting = Container.useAnyWaiting(C.verifyPhoneNumberWaitingKey)

  const verifyPhoneNumber = C.useSettingsPhoneState(s => s.dispatch.verifyPhoneNumber)
  const resendVerificationForPhone = C.useSettingsPhoneState(s => s.dispatch.resendVerificationForPhone)

  const clearPhoneNumberAdd = C.useSettingsPhoneState(s => s.dispatch.clearPhoneNumberAdd)

  const _onContinue = (phoneNumber: string, code: string) => {
    verifyPhoneNumber(phoneNumber, code)
  }
  const _onResend = (phoneNumber: string) => {
    resendVerificationForPhone(phoneNumber)
  }
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const onCleanup = clearPhoneNumberAdd
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
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
