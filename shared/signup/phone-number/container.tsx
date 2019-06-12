import * as React from 'react'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as SettingsConstants from '../../constants/settings'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyWaiting} from '../../constants/waiting'
import EnterPhoneNumber, {Props} from '.'

const mapStateToProps = (state: Container.TypedState) => ({
  error: state.settings.phoneNumbers.error,
  pendingVerification: state.settings.phoneNumbers.pendingVerification,
  waiting: anyWaiting(state, SettingsConstants.addPhoneNumberWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  onContinue: (phoneNumber: string, allowSearch: boolean) =>
    dispatch(SettingsGen.createAddPhoneNumber({allowSearch, phoneNumber})),
  onGoToVerify: () => console.log('DANNYDEBUG yep'), // TODO
  onSkip: () => dispatch(RouteTreeGen.createClearModals()), // TODO route to add-email
})

type WatcherProps = Props & {
  onGoToVerify: () => void
  pendingVerification: string
}
// Watches for `pendingVerification` to change and routes to the verification screen
class WatchForGoToVerify extends React.Component<WatcherProps> {
  componentDidUpdate(prevProps: WatcherProps) {
    if (
      !this.props.error &&
      !!this.props.pendingVerification &&
      this.props.pendingVerification !== prevProps.pendingVerification
    ) {
      this.props.onGoToVerify()
    }
  }
  render() {
    return (
      <EnterPhoneNumber
        error={this.props.error}
        onContinue={this.props.onContinue}
        onSkip={this.props.onSkip}
        waiting={this.props.waiting}
      />
    )
  }
}

const ConnectedEnterPhoneNumber = Container.connect(mapStateToProps, mapDispatchToProps)(WatchForGoToVerify)

export default ConnectedEnterPhoneNumber
