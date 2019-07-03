import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {anyWaiting} from '../../constants/waiting'
import * as Constants from '../../constants/settings'
import SignupFeedback from '.'
import * as SettingsGen from '../../actions/settings-gen'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  loggedOut: !state.config.loggedIn,
  sendError: state.settings.feedback.error,
  sending: anyWaiting(state, Constants.sendFeedbackWaitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSendFeedback: (feedback, sendLogs, sendMaxBytes) =>
    dispatch(SettingsGen.createSendFeedback({feedback, sendLogs, sendMaxBytes})),
})

const ConnectedSignupFeedback = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...s, ...d, ...o}),
  'ConnectedSignupFeedback'
)(SignupFeedback)

// @ts-ignore fix this
ConnectedSignupFeedback.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerRightActions: null,
}

export default ConnectedSignupFeedback
