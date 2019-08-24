import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {anyWaiting} from '../../constants/waiting'
import * as Constants from '../../constants/settings'
import SignupFeedback from '.'
import * as SettingsGen from '../../actions/settings-gen'

type OwnProps = {}

const ConnectedSignupFeedback = Container.namedConnect(
  (state: Container.TypedState) => ({
    loggedOut: !state.config.loggedIn,
    sendError: state.settings.feedback.error,
    sending: anyWaiting(state, Constants.sendFeedbackWaitingKey),
  }),

  (dispatch: Container.TypedDispatch) => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSendFeedback: (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) =>
      dispatch(SettingsGen.createSendFeedback({feedback, sendLogs, sendMaxBytes})),
  }),
  (s, d, o: OwnProps) => ({...s, ...d, ...o}),
  'ConnectedSignupFeedback'
)(SignupFeedback)

export default ConnectedSignupFeedback
