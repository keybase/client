import * as C from '@/constants'
import * as React from 'react'
import VerifyPhoneNumber, {type Props} from './verify'

type WatcherProps = Props & {
  onCleanup: () => void
  onSuccess: () => void
  verificationStatus?: 'success' | 'error'
}

// Watches for verification to succeed and exits
const WatchForSuccess = (props: WatcherProps) => {
  const {verificationStatus, onSuccess, onCleanup} = props

  React.useEffect(() => {
    if (verificationStatus === 'success') {
      onSuccess()
    }
  }, [verificationStatus, onSuccess])

  React.useEffect(() => {
    return () => {
      onCleanup()
    }
  }, [onCleanup])

  return (
    <VerifyPhoneNumber
      error={props.error}
      onBack={props.onBack}
      onContinue={props.onContinue}
      onResend={props.onResend}
      phoneNumber={props.phoneNumber}
      resendWaiting={props.resendWaiting}
      verifyWaiting={props.verifyWaiting}
    />
  )
}

const Container = () => {
  const error = C.useSettingsPhoneState(s => (s.verificationState === 'error' ? s.error : ''))
  const phoneNumber = C.useSettingsPhoneState(s => s.pendingVerification)
  const resendWaiting = C.Waiting.useAnyWaiting([
    C.SettingsPhone.resendVerificationForPhoneWaitingKey,
    C.SettingsPhone.addPhoneNumberWaitingKey,
  ])
  const verificationStatus = C.useSettingsPhoneState(s => s.verificationState)
  const verifyWaiting = C.Waiting.useAnyWaiting(C.SettingsPhone.verifyPhoneNumberWaitingKey)

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

export default Container
