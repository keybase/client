import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import * as RouteTreeGen from '../../actions/route-tree-gen'
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
  const defaultCountry = SettingsConstants.usePhoneState(s => s.defaultCountry)
  const error = SettingsConstants.usePhoneState(s => s.error)
  const pendingVerification = SettingsConstants.usePhoneState(s => s.pendingVerification)
  const waiting = Container.useAnyWaiting(SettingsConstants.addPhoneNumberWaitingKey)

  const dispatch = Container.useDispatch()
  const onClear = () => {
    dispatch(SettingsGen.createClearPhoneNumberErrors())
  }

  const addPhoneNumber = SettingsConstants.usePhoneState(s => s.dispatch.addPhoneNumber)
  const onContinue = addPhoneNumber
  const onGoToVerify = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['signupVerifyPhoneNumber']}))
  }
  const onSkip = () => {
    dispatch(SettingsGen.createClearPhoneNumberAdd())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: ['signupEnterEmail'],
        replace: true,
      })
    )
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
