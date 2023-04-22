import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {anyWaiting} from '../../constants/waiting'
import * as Constants from '../../constants/settings'
import SignupFeedback from '.'
import * as SettingsGen from '../../actions/settings-gen'

export default () => {
  const loggedOut = Container.useSelector(state => !state.config.loggedIn)
  const sendError = Container.useSelector(state => state.settings.feedback.error)
  const sending = Container.useSelector(state => anyWaiting(state, Constants.sendFeedbackWaitingKey))

  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSendFeedback = (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => {
    dispatch(SettingsGen.createSendFeedback({feedback, sendLogs, sendMaxBytes}))
  }
  const props = {
    loggedOut,
    onBack,
    onSendFeedback,
    sendError,
    sending,
  }
  return <SignupFeedback {...props} />
}
