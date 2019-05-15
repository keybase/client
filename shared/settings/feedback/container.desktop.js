// @flow
import Feedback from './index'
import {namedConnect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import {anyWaiting} from '../../constants/waiting'
import * as Constants from '../../constants/settings'

type OwnProps = {||}

const mapStateToProps = state => ({
  feedback: state.settings.feedback.feedback,
  sendError: state.settings.feedback.error,
  sendLogs: state.settings.feedback.sendLogs,
  sending: anyWaiting(state, Constants.sendFeedbackWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onChangeFeedback: feedback => dispatch(SettingsGen.createSetFeedback({feedback})),
  onChangeSendLogs: sendLogs => dispatch(SettingsGen.createSetSendLogs({sendLogs})),
  onSendFeedbackContained: () => dispatch(SettingsGen.createSendFeedback()),
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Feedback'
)(Feedback)
