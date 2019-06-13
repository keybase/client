import Feedback from './index'
import {namedConnect, RouteProps, getRouteProps} from '../../util/container'
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
  onSendFeedback: (feedback, sendLogs, sendMaxBytes) =>
    dispatch(SettingsGen.createSendFeedback({feedback, sendLogs, sendMaxBytes})),
})

const mergeProps = (s, d, o: OwnProps) => ({
  ...s,
  ...d,
  feedback: getRouteProps(o, 'feedback') || '',
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Feedback')(Feedback)
