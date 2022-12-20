import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyWaiting} from '../../constants/waiting'
import EnterPhoneNumber, {type Props} from '.'

type OwnProps = {}

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

const ConnectedEnterPhoneNumber = Container.connect(
  state => ({
    defaultCountry: state.settings.phoneNumbers.defaultCountry,
    error: state.settings.phoneNumbers.error,
    pendingVerification: state.settings.phoneNumbers.pendingVerification,
    waiting: anyWaiting(state, SettingsConstants.addPhoneNumberWaitingKey),
  }),
  dispatch => ({
    onClear: () => dispatch(SettingsGen.createClearPhoneNumberErrors()),
    onContinue: (phoneNumber: string, searchable: boolean) =>
      dispatch(SettingsGen.createAddPhoneNumber({phoneNumber, searchable})),
    onGoToVerify: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['signupVerifyPhoneNumber']})),
    onSkip: () => {
      dispatch(SettingsGen.createClearPhoneNumberAdd())
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: ['signupEnterEmail'],
          replace: true,
        })
      )
    },
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(WatchForGoToVerify)

export default ConnectedEnterPhoneNumber
