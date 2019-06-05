import Feedback from './index'
import {namedConnect, RouteProps} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import {anyWaiting} from '../../constants/waiting'
import * as Constants from '../../constants/settings'

type OwnProps = RouteProps<{feedback: string}, {}>

const mapStateToProps = state => ({
  loggedOut: !state.config.loggedIn,
  sendError: state.settings.feedback.error,
  sending: anyWaiting(state, Constants.sendFeedbackWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSendFeedback: (feedback, sendLogs) => dispatch(SettingsGen.createSendFeedback({feedback, sendLogs})),
})

const mergeProps = (s, d, o: OwnProps) => ({
  ...s,
  ...d,
  feedback: o.routeProps.get('feedback'),
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Feedback')(Feedback)
