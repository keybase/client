import * as Constants from '../../constants/settings'
import * as ConfigConstants from '../../constants/config'
import * as Container from '../../util/container'
import * as RouterConstants from '../../constants/router2'
import Feedback from '.'
import type {Props} from './container'
import {useSendFeedback} from './shared'

export default (ownProps: Props) => {
  const {sendFeedback, error} = useSendFeedback()

  const feedback = ownProps.feedback ?? ''
  const loggedOut = ConfigConstants.useConfigState(s => !s.loggedIn)
  const sending = Container.useAnyWaiting(Constants.sendFeedbackWaitingKey)
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const onSendFeedback = sendFeedback
  const props = {
    feedback,
    loggedOut,
    onBack,
    onFeedbackDone: () => null,
    onSendFeedback,
    sendError: error,
    sending,
    showInternalSuccessBanner: true,
  }
  return <Feedback {...props} />
}
