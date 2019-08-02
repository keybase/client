import Feedback from './index'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import {anyWaiting} from '../../constants/waiting'
import * as Constants from '../../constants/settings'

type OwnProps = Container.RouteProps<{feedback: string}>

export default Container.namedConnect(
  state => ({
    loggedOut: !state.config.loggedIn,
    sendError: state.settings.feedback.error,
    sending: anyWaiting(state, Constants.sendFeedbackWaitingKey),
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSendFeedback: (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) =>
      dispatch(SettingsGen.createSendFeedback({feedback, sendLogs, sendMaxBytes})),
  }),
  (s, d, o: OwnProps) => ({
    ...s,
    ...d,
    feedback: Container.getRouteProps(o, 'feedback', ''),
    onFeedbackDone: () => null,
    showInternalSuccessBanner: true,
  }),
  'Feedback'
)(Feedback)
