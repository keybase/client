import Feedback from './index'
import {namedConnect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import {anyWaiting} from '../../constants/waiting'
import * as Constants from '../../constants/settings'

type OwnProps = {}

const mapStateToProps = state => ({
  loggedOut: !state.config.loggedIn,
  sendError: state.settings.feedback.error,
  sending: anyWaiting(state, Constants.sendFeedbackWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSendFeedback: (feedback, sendLogs) => dispatch(SettingsGen.createSendFeedback({feedback, sendLogs})),
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Feedback')(Feedback)
