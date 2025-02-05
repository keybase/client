import * as C from '@/constants'
import * as React from 'react'
import EnterPhoneNumber, {type Props} from '.'

type WatcherProps = Props & {
  onClear: () => void
  onGoToVerify: () => void
  pendingVerification: string
}

const WatchForGoToVerify = (props: WatcherProps) => {
  const {onClear, onGoToVerify, pendingVerification, error} = props

  React.useEffect(() => {
    return () => {
      onClear()
    }
  }, [onClear])

  const lastPendingVerificationRef = React.useRef(pendingVerification)
  React.useEffect(() => {
    if (!error && pendingVerification && lastPendingVerificationRef.current !== pendingVerification) {
      onGoToVerify()
    }
    lastPendingVerificationRef.current = pendingVerification
  }, [pendingVerification, error, onGoToVerify])

  return (
    <EnterPhoneNumber
      defaultCountry={props.defaultCountry}
      error={props.error}
      onContinue={props.onContinue}
      onSkip={props.onSkip}
      waiting={props.waiting}
    />
  )
}

const ConnectedEnterPhoneNumber = () => {
  const defaultCountry = C.useSettingsPhoneState(s => s.defaultCountry)
  const error = C.useSettingsPhoneState(s => s.error)
  const pendingVerification = C.useSettingsPhoneState(s => s.pendingVerification)
  const waiting = C.Waiting.useAnyWaiting(C.SettingsPhone.addPhoneNumberWaitingKey)
  const clearPhoneNumberErrors = C.useSettingsPhoneState(s => s.dispatch.clearPhoneNumberErrors)
  const clearPhoneNumberAdd = C.useSettingsPhoneState(s => s.dispatch.clearPhoneNumberAdd)
  const onClear = clearPhoneNumberErrors
  const addPhoneNumber = C.useSettingsPhoneState(s => s.dispatch.addPhoneNumber)
  const onContinue = addPhoneNumber
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onGoToVerify = React.useCallback(() => {
    navigateAppend('signupVerifyPhoneNumber')
  }, [navigateAppend])
  const onSkip = React.useCallback(() => {
    clearPhoneNumberAdd()
    navigateAppend('signupEnterEmail', true)
  }, [clearPhoneNumberAdd, navigateAppend])

  const props = {
    defaultCountry,
    error,
    onClear,
    onContinue,
    onGoToVerify,
    onSkip,
    pendingVerification,
    waiting,
  }

  return <WatchForGoToVerify {...props} />
}

export default ConnectedEnterPhoneNumber
