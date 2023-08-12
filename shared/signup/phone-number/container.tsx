import * as C from '../../constants'
import * as React from 'react'
import * as Container from '../../util/container'
import EnterPhoneNumber, {type Props} from '.'

type WatcherProps = Props & {
  onClear: () => void
  onGoToVerify: () => void
  pendingVerification: string
}
// Watches for `pendingVerification` to change and routes to the verification screen
export class WatchForGoToVerify extends React.Component<WatcherProps> {
  componentDidUpdate(prevProps: WatcherProps) {
    if (
      !this.props.error &&
      !!this.props.pendingVerification &&
      this.props.pendingVerification !== prevProps.pendingVerification
    ) {
      this.props.onGoToVerify()
    }
  }
  componentWillUnmount() {
    this.props.onClear()
  }
  render() {
    return (
      <EnterPhoneNumber
        defaultCountry={this.props.defaultCountry}
        error={this.props.error}
        onContinue={this.props.onContinue}
        onSkip={this.props.onSkip}
        waiting={this.props.waiting}
      />
    )
  }
}

const ConnectedEnterPhoneNumber = () => {
  const defaultCountry = C.useSettingsPhoneState(s => s.defaultCountry)
  const error = C.useSettingsPhoneState(s => s.error)
  const pendingVerification = C.useSettingsPhoneState(s => s.pendingVerification)
  const waiting = Container.useAnyWaiting(C.addPhoneNumberWaitingKey)
  const clearPhoneNumberErrors = C.useSettingsPhoneState(s => s.dispatch.clearPhoneNumberErrors)
  const clearPhoneNumberAdd = C.useSettingsPhoneState(s => s.dispatch.clearPhoneNumberAdd)
  const onClear = clearPhoneNumberErrors
  const addPhoneNumber = C.useSettingsPhoneState(s => s.dispatch.addPhoneNumber)
  const onContinue = addPhoneNumber
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onGoToVerify = () => {
    navigateAppend('signupVerifyPhoneNumber')
  }
  const onSkip = () => {
    clearPhoneNumberAdd()
    navigateAppend('signupEnterEmail', true)
  }
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
