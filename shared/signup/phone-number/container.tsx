import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyWaiting} from '../../constants/waiting'
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
  const defaultCountry = Container.useSelector(state => state.settings.phoneNumbers.defaultCountry)
  const error = Container.useSelector(state => state.settings.phoneNumbers.error)
  const pendingVerification = Container.useSelector(state => state.settings.phoneNumbers.pendingVerification)
  const waiting = Container.useSelector(state =>
    anyWaiting(state, SettingsConstants.addPhoneNumberWaitingKey)
  )

  const dispatch = Container.useDispatch()
  const onClear = () => {
    dispatch(SettingsGen.createClearPhoneNumberErrors())
  }
  const onContinue = (phoneNumber: string, searchable: boolean) => {
    dispatch(SettingsGen.createAddPhoneNumber({phoneNumber, searchable}))
  }
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
