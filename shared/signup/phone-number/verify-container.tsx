import * as React from 'react'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
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
  const error = Container.useSelector(state =>
    state.settings.phoneNumbers.verificationState === 'error' ? state.settings.phoneNumbers.error : ''
  )
  const phoneNumber = Container.useSelector(state => state.settings.phoneNumbers.pendingVerification)
  const resendWaiting = Container.useAnyWaiting([
    SettingsConstants.resendVerificationForPhoneWaitingKey,
    SettingsConstants.addPhoneNumberWaitingKey,
  ])
  const verificationStatus = Container.useSelector(state => state.settings.phoneNumbers.verificationState)
  const verifyWaiting = Container.useAnyWaiting(SettingsConstants.verifyPhoneNumberWaitingKey)
  const dispatch = Container.useDispatch()
  const _onContinue = (phoneNumber: string, code: string) => {
    dispatch(SettingsGen.createVerifyPhoneNumber({code, phoneNumber}))
  }
  const _onResend = (phoneNumber: string) => {
    dispatch(SettingsGen.createResendVerificationForPhoneNumber({phoneNumber}))
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onCleanup = () => {
    dispatch(SettingsGen.createClearPhoneNumberAdd())
  }
  const onSuccess = () => {
    dispatch(RouteTreeGen.createClearModals())
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
