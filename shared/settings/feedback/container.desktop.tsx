import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import Feedback from '.'
import type {Props} from './container'

export default (ownProps: Props) => {
  const feedback = ownProps.feedback ?? ''
  const loggedOut = Container.useSelector(state => !state.config.loggedIn)
  const sendError = Container.useSelector(state => state.settings.feedback.error)
  const sending = Container.useAnyWaiting(Constants.sendFeedbackWaitingKey)

  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSendFeedback = (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => {
    dispatch(SettingsGen.createSendFeedback({feedback, sendLogs, sendMaxBytes}))
  }
  const props = {
    feedback,
    loggedOut,
    onBack,
    onFeedbackDone: () => null,
    onSendFeedback,
    sendError,
    sending,
    showInternalSuccessBanner: true,
  }
  return <Feedback {...props} />
}
