import * as C from '@/constants'
import * as Constants from '@/constants/settings'
import Feedback from '.'
import type {Props} from './container'
import {useSendFeedback} from './shared'

const Container = (ownProps: Props) => {
  const {sendFeedback, error} = useSendFeedback()
  const feedback = ownProps.feedback ?? ''
  const loggedOut = C.useConfigState(s => !s.loggedIn)
  const sending = C.Waiting.useAnyWaiting(Constants.sendFeedbackWaitingKey)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
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

export default Container
